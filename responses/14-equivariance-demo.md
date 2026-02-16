Here’s a self‑contained client component you can drop into components/EquivarianceInvarianceDemo.tsx in a Next.js app. It uses GSAP for smooth transforms, shows input vs invariant vs equivariant “networks”, and matches your color + concept requirements. 

attachments-bundle

tsx
Copy code
'use client'

import React, { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'

// You can swap these for imports from ../lib/mathObjects if you prefer.
const COLORS = {
  background: '#0d1219',
  input: '#14b8a6', // teal
  output: '#f59e0b', // orange
  arrows: '#9ca3af', // gray-400
  text: '#e5e7eb',
  subtle: '#6b7280',
}

const MAX_TRANSLATE = 80

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function buildTransform(
  rotationDeg: number,
  translation: { x: number; y: number },
  reflection: { x: boolean; y: boolean },
  scale = 1
): string {
  const sx = reflection.x ? -scale : scale
  const sy = reflection.y ? -scale : scale
  const { x, y } = translation
  return `translate(${x}px, ${y}px) rotate(${rotationDeg}deg) scale(${sx}, ${sy})`
}

export default function EquivarianceInvarianceDemo() {
  const [rotation, setRotation] = useState(0)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [reflectX, setReflectX] = useState(false)
  const [reflectY, setReflectY] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const dragStartRef = useRef<{
    x: number
    y: number
    tx: number
    ty: number
  } | null>(null)

  const inputShapeRef = useRef<HTMLDivElement | null>(null)
  const invariantShapeRef = useRef<HTMLDivElement | null>(null)
  const equivariantShapeRef = useRef<HTMLDivElement | null>(null)

  // Animate transforms with GSAP
  useEffect(() => {
    const translation = { x: tx, y: ty }
    const reflection = { x: reflectX, y: reflectY }

    const inputTransform = buildTransform(rotation, translation, reflection, 1)
    const equivTransform = buildTransform(rotation, translation, reflection, 1)
    const invariantTransform = buildTransform(0, { x: 0, y: 0 }, { x: false, y: false }, 1)

    if (inputShapeRef.current) {
      gsap.to(inputShapeRef.current, {
        transform: inputTransform,
        duration: 0.35,
        ease: 'power2.out',
      })
    }

    if (equivariantShapeRef.current) {
      gsap.to(equivariantShapeRef.current, {
        transform: equivTransform,
        duration: 0.35,
        ease: 'power2.out',
      })
    }

    if (invariantShapeRef.current) {
      gsap.to(invariantShapeRef.current, {
        transform: invariantTransform,
        duration: 0.35,
        ease: 'power2.out',
      })
    }
  }, [rotation, tx, ty, reflectX, reflectY])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      tx,
      ty,
    }
    setIsDragging(true)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return
    const dx = event.clientX - dragStartRef.current.x
    const dy = event.clientY - dragStartRef.current.y
    setTx(clamp(dragStartRef.current.tx + dx, -MAX_TRANSLATE, MAX_TRANSLATE))
    setTy(clamp(dragStartRef.current.ty + dy, -MAX_TRANSLATE, MAX_TRANSLATE))
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setIsDragging(false)
    dragStartRef.current = null
  }

  const handleReset = () => {
    setRotation(0)
    setTx(0)
    setTy(0)
    setReflectX(false)
    setReflectY(false)
  }

  const poseSummary = `pos=(${tx.toFixed(0)}, ${ty.toFixed(
    0
  )}) · rot=${rotation.toFixed(0)}° · flip=[x:${reflectX ? 'on' : 'off'}, y:${
    reflectY ? 'on' : 'off'
  }]`

  return (
    <section
      className="equivariance-demo card interactive-card"
      style={{
        backgroundColor: COLORS.background,
        borderRadius: '1rem',
        padding: '1.5rem',
        color: COLORS.text,
        border: '1px solid rgba(148,163,184,0.3)',
      }}
    >
      <header style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 600, marginBottom: '0.25rem' }}>
          Equivariance vs Invariance (Vision Intuition)
        </h2>
        <p style={{ fontSize: '0.9rem', color: COLORS.subtle, maxWidth: 640 }}>
          Drag or rotate the teal arrow (input). A classification network wants invariance
          (orange output doesn&apos;t move), while an object detection network wants equivariance
          (orange output moves in sync).
        </p>
      </header>

      {/* Main visual panels */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '1rem',
          alignItems: 'stretch',
        }}
      >
        {/* INPUT PANEL */}
        <div
          style={{
            background: 'radial-gradient(circle at top, rgba(15,23,42,1), rgba(15,23,42,0.2))',
            borderRadius: '0.9rem',
            padding: '0.75rem 0.75rem 0.9rem',
            border: '1px solid rgba(55,65,81,0.9)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: COLORS.subtle,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: '0.5rem',
            }}
          >
            <span>Input pattern</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
              teal arrow ∈ ℝ² (position, rotation, flips)
            </span>
          </div>

          <div
            style={{
              position: 'relative',
              flex: 1,
              minHeight: 180,
              borderRadius: '0.75rem',
              background:
                'radial-gradient(circle at 30% 20%, rgba(15,118,110,0.35), transparent 55%)',
              boxShadow: '0 10px 35px rgba(15,23,42,0.9)',
              overflow: 'hidden',
              cursor: isDragging ? 'grabbing' : 'grab',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerLeave={(e) => {
              if (isDragging) endDrag(e)
            }}
          >
            {/* Drag hint */}
            <div
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                fontSize: '0.7rem',
                color: COLORS.subtle,
                backgroundColor: 'rgba(15,23,42,0.85)',
                padding: '0.2rem 0.4rem',
                borderRadius: '999px',
                border: '1px solid rgba(75,85,99,0.8)',
                pointerEvents: 'none',
              }}
            >
              drag to translate
            </div>

            {/* Transformation arrows (gray) */}
            <svg
              viewBox="0 0 120 120"
              preserveAspectRatio="xMidYMid meet"
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0.35,
                pointerEvents: 'none',
              }}
            >
              {/* horizontal arrow */}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="5"
                  markerHeight="5"
                  refX="0"
                  refY="2.5"
                  orient="auto"
                >
                  <polygon points="0 0, 5 2.5, 0 5" fill={COLORS.arrows} />
                </marker>
              </defs>
              <line
                x1="15"
                y1="60"
                x2="105"
                y2="60"
                stroke={COLORS.arrows}
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
              {/* vertical arrow */}
              <line
                x1="60"
                y1="105"
                x2="60"
                y2="15"
                stroke={COLORS.arrows}
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
              {/* rotation arc */}
              <path
                d="M75 40 A20 20 0 1 1 50 35"
                fill="none"
                stroke={COLORS.arrows}
                strokeWidth="2"
              />
              <polygon points="49 35, 55 37, 52 30" fill={COLORS.arrows} />
            </svg>

            {/* Arrow shape wrapper that GSAP rotates/translates */}
            <div
              ref={inputShapeRef}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 90,
                height: 90,
                transformOrigin: '50% 50%',
              }}
            >
              <svg viewBox="0 0 100 100" width="100%" height="100%">
                <polygon
                  points="50,10 90,50 70,50 70,90 30,90 30,50 10,50"
                  fill="rgba(20,184,166,0.14)"
                  stroke={COLORS.input}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          <p style={{ fontSize: '0.8rem', color: COLORS.subtle, marginTop: '0.2rem' }}>
            We apply a group of transformations to the input: rotation, translation, and
            reflections across the x/y axes.
          </p>
        </div>

        {/* INVARIANT NETWORK PANEL */}
        <div
          style={{
            background: 'linear-gradient(140deg, rgba(15,23,42,0.9), rgba(24,24,27,0.9))',
            borderRadius: '0.9rem',
            padding: '0.75rem 0.75rem 0.9rem',
            border: '1px solid rgba(55,65,81,0.9)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: COLORS.subtle,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: '0.5rem',
            }}
          >
            <span>Invariant network</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>classification</span>
          </div>

          <div
            style={{
              position: 'relative',
              flex: 1,
              minHeight: 180,
              borderRadius: '0.75rem',
              background:
                'radial-gradient(circle at 50% 0%, rgba(245,158,11,0.26), rgba(15,23,42,0.9))',
              boxShadow: '0 10px 35px rgba(15,23,42,0.9)',
              overflow: 'hidden',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {/* Canonical representation of the class */}
              <div
                ref={invariantShapeRef}
                style={{
                  width: 70,
                  height: 70,
                  transformOrigin: '50% 50%',
                }}
              >
                <svg viewBox="0 0 100 100" width="100%" height="100%">
                  <polygon
                    points="50,10 90,50 70,50 70,90 30,90 30,50 10,50"
                    fill="rgba(245,158,11,0.16)"
                    stroke={COLORS.output}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* Class logits box */}
              <div
                style={{
                  flex: 1,
                  marginLeft: '0.5rem',
                  fontSize: '0.78rem',
                  backgroundColor: 'rgba(15,23,42,0.9)',
                  borderRadius: '0.6rem',
                  padding: '0.6rem 0.7rem',
                  border: '1px solid rgba(75,85,99,0.9)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.25rem',
                    color: COLORS.subtle,
                  }}
                >
                  <span>Class scores</span>
                  <span style={{ fontSize: '0.72rem' }}>invariant</span>
                </div>
                <div style={{ display: 'grid', gap: '0.22rem' }}>
                  {['background', 'triangle', 'arrow', 'square'].map((label, idx) => {
                    const isArrow = label === 'arrow'
                    return (
                      <div
                        key={label}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <div
                          style={{
                            height: 6,
                            borderRadius: '999px',
                            flex: 1,
                            background: isArrow
                              ? `linear-gradient(90deg, ${COLORS.output}, rgba(245,158,11,0.1))`
                              : 'linear-gradient(90deg, rgba(55,65,81,0.9), rgba(31,41,55,0.9))',
                            opacity: isArrow ? 1 : 0.6,
                          }}
                        />
                        <span
                          style={{
                            width: 64,
                            textAlign: 'right',
                            fontSize: '0.7rem',
                            color: isArrow ? COLORS.output : COLORS.subtle,
                          }}
                        >
                          {label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <p
              style={{
                fontSize: '0.78rem',
                color: COLORS.subtle,
                marginTop: '0.5rem',
              }}
            >
              No matter how you move the input arrow, the predicted label remains{' '}
              <span style={{ color: COLORS.output }}>“arrow”</span>. The network is{' '}
              <strong>invariant</strong> to these transforms — pose information is discarded.
            </p>
          </div>
        </div>

        {/* EQUIVARIANT NETWORK PANEL */}
        <div
          style={{
            background: 'linear-gradient(200deg, rgba(15,23,42,0.9), rgba(24,24,27,0.9))',
            borderRadius: '0.9rem',
            padding: '0.75rem 0.75rem 0.9rem',
            border: '1px solid rgba(55,65,81,0.9)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: COLORS.subtle,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: '0.5rem',
            }}
          >
            <span>Equivariant network</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>object detection</span>
          </div>

          <div
            style={{
              position: 'relative',
              flex: 1,
              minHeight: 180,
              borderRadius: '0.75rem',
              background:
                'radial-gradient(circle at 60% 0%, rgba(245,158,11,0.26), rgba(15,23,42,0.9))',
              boxShadow: '0 10px 35px rgba(15,23,42,0.9)',
              overflow: 'hidden',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            {/* Grid to hint at feature map */}
            <svg
              viewBox="0 0 120 120"
              preserveAspectRatio="xMidYMid meet"
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0.15,
                pointerEvents: 'none',
              }}
            >
              {Array.from({ length: 5 }).map((_, i) => {
                const t = (i + 1) * (120 / 6)
                return (
                  <React.Fragment key={i}>
                    <line
                      x1={t}
                      y1={10}
                      x2={t}
                      y2={110}
                      stroke="rgba(148,163,184,0.6)"
                      strokeWidth="0.5"
                    />
                    <line
                      x1={10}
                      y1={t}
                      x2={110}
                      y2={t}
                      stroke="rgba(148,163,184,0.6)"
                      strokeWidth="0.5"
                    />
                  </React.Fragment>
                )
              })}
            </svg>

            {/* Arrow + bounding box that move equivariantly */}
            <div
              style={{
                position: 'relative',
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
              }}
            >
              <div
                ref={equivariantShapeRef}
                style={{
                  position: 'relative',
                  width: 90,
                  height: 90,
                  transformOrigin: '50% 50%',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: '-10%',
                    borderRadius: '0.6rem',
                    border: `1.5px solid ${COLORS.output}`,
                    boxShadow: '0 0 0 1px rgba(15,23,42,0.9)',
                  }}
                />
                <svg viewBox="0 0 100 100" width="100%" height="100%">
                  <polygon
                    points="50,10 90,50 70,50 70,90 30,90 30,50 10,50"
                    fill="rgba(245,158,11,0.16)"
                    stroke={COLORS.output}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Pose + detection style readout */}
            <div
              style={{
                marginTop: '0.6rem',
                fontSize: '0.78rem',
                display: 'grid',
                gap: '0.25rem',
                zIndex: 2,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  color: COLORS.subtle,
                }}
              >
                <span>Detection head (equivariant)</span>
                <span style={{ fontSize: '0.72rem' }}>bounding box + class + pose</span>
              </div>
              <div
                style={{
                  borderRadius: '0.6rem',
                  border: '1px solid rgba(75,85,99,0.9)',
                  backgroundColor: 'rgba(15,23,42,0.9)',
                  padding: '0.4rem 0.55rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.76rem',
                  }}
                >
                  <span style={{ color: COLORS.output }}>class: arrow</span>
                  <span style={{ color: COLORS.subtle }}>equivariant features</span>
                </div>
                <div
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize: '0.72rem',
                    color: COLORS.text,
                    opacity: 0.9,
                  }}
                >
                  {poseSummary}
                </div>
              </div>
              <p style={{ fontSize: '0.78rem', color: COLORS.subtle }}>
                When the input moves, the predicted{' '}
                <span style={{ color: COLORS.output }}>bounding box</span> and pose move
                with it. The mapping is <strong>equivariant</strong>: transforms of the
                input induce matching transforms of the output.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          marginTop: '1.25rem',
          paddingTop: '0.9rem',
          borderTop: '1px solid rgba(55,65,81,0.9)',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2.2fr) minmax(0, 1.1fr)',
          gap: '1rem',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {/* Rotation */}
          <label style={{ fontSize: '0.8rem', display: 'grid', gap: '0.25rem' }}>
            <span
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: COLORS.subtle,
              }}
            >
              <span>Rotation</span>
              <span>{rotation.toFixed(0)}°</span>
            </span>
            <input
              type="range"
              min={0}
              max={360}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </label>

          {/* Translation sliders */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '0.75rem',
            }}
          >
            <label style={{ fontSize: '0.8rem', display: 'grid', gap: '0.25rem' }}>
              <span
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: COLORS.subtle,
                }}
              >
                <span>Translate X</span>
                <span>{tx.toFixed(0)} px</span>
              </span>
              <input
                type="range"
                min={-MAX_TRANSLATE}
                max={MAX_TRANSLATE}
                value={tx}
                onChange={(e) => setTx(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </label>
            <label style={{ fontSize: '0.8rem', display: 'grid', gap: '0.25rem' }}>
              <span
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: COLORS.subtle,
                }}
              >
                <span>Translate Y</span>
                <span>{ty.toFixed(0)} px</span>
              </span>
              <input
                type="range"
                min={-MAX_TRANSLATE}
                max={MAX_TRANSLATE}
                value={ty}
                onChange={(e) => setTy(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </label>
          </div>
        </div>

        {/* Reflection + reset + legend */}
        <div
          style={{
            display: 'grid',
            gap: '0.6rem',
            fontSize: '0.8rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setReflectX((v) => !v)}
              style={{
                flex: 1,
                padding: '0.45rem 0.7rem',
                borderRadius: '999px',
                border: `1px solid ${
                  reflectX ? COLORS.input : 'rgba(75,85,99,0.9)'
                }`,
                backgroundColor: reflectX
                  ? 'rgba(20,184,166,0.1)'
                  : 'rgba(15,23,42,0.9)',
                color: reflectX ? COLORS.input : COLORS.subtle,
              }}
            >
              Flip across x‑axis
            </button>
            <button
              type="button"
              onClick={() => setReflectY((v) => !v)}
              style={{
                flex: 1,
                padding: '0.45rem 0.7rem',
                borderRadius: '999px',
                border: `1px solid ${
                  reflectY ? COLORS.input : 'rgba(75,85,99,0.9)'
                }`,
                backgroundColor: reflectY
                  ? 'rgba(20,184,166,0.1)'
                  : 'rgba(15,23,42,0.9)',
                color: reflectY ? COLORS.input : COLORS.subtle,
              }}
            >
              Flip across y‑axis
            </button>
          </div>

          <button
            type="button"
            onClick={handleReset}
            style={{
              justifySelf: 'flex-start',
              padding: '0.35rem 0.8rem',
              borderRadius: '999px',
              border: '1px solid rgba(75,85,99,0.9)',
              backgroundColor: 'transparent',
              color: COLORS.subtle,
              fontSize: '0.78rem',
            }}
          >
            Reset transform
          </button>

          <p style={{ color: COLORS.subtle, fontSize: '0.78rem' }}>
            <span style={{ color: COLORS.input }}>Equivariance</span> preserves pose
            information and is ideal for tasks like{' '}
            <span style={{ color: COLORS.output }}>object detection</span>.{' '}
            <span style={{ color: COLORS.output }}>Invariance</span> throws away pose but
            simplifies decisions for tasks like image{' '}
            <span style={{ color: COLORS.output }}>classification</span>.
          </p>
        </div>
      </div>
    </section>
  )
}


If you’d like, I can also give you a small CSS snippet for .card, .interactive-card, etc., that matches the rest of your site, but this component will already work and respect your color + GSAP + interaction requirements.
