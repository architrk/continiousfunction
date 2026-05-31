import type { CSSProperties } from 'react'
import { AbsoluteFill, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'

type FocusBox = {
  x: number
  y: number
  width: number
  height: number
  label: string
}

type TourScene = {
  eyebrow: string
  title: string
  body: string
  image: string
  accent: string
  step: string
  focus?: FocusBox
  bullets: string[]
}

const SCENE_FRAMES = 210
const IMAGE_WIDTH = 1260
const IMAGE_HEIGHT = 788
const IMAGE_LEFT = 585
const IMAGE_TOP = 146

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
}

const scenes: TourScene[] = [
  {
    eyebrow: 'What It Is',
    title: 'A paper-to-understanding loop for frontier AI.',
    body: 'Continuous Function turns papers, equations, model behavior, and systems tradeoffs into connected concepts, notebooks, demos, and source-grounded discussion.',
    image: 'home.png',
    accent: '#0f766e',
    step: '01',
    focus: { x: 88, y: 736, width: 594, height: 60, label: 'Choose an entry point' },
    bullets: ['Map a paper', 'Find the next concept', 'Study a connected route'],
  },
  {
    eyebrow: 'Step 1',
    title: 'Start with the thing you are actually trying to understand.',
    body: 'Paste a paper clue or open the mapper. The app turns the clue into concepts, equations, and a next experiment instead of leaving you with a summary.',
    image: 'paper-map.png',
    accent: '#c64b33',
    step: '02',
    focus: { x: 88, y: 588, width: 360, height: 54, label: 'Start mapping' },
    bullets: ['Bring a paper clue', 'Inspect confidence', 'Open the serving module'],
  },
  {
    eyebrow: 'Step 2',
    title: 'Use the graph when you need prerequisite repair.',
    body: 'The graph is not decoration. It shows what to learn next, which ideas support the current question, and where a missing foundation is blocking progress.',
    image: 'graph.png',
    accent: '#315f7d',
    step: '03',
    focus: { x: 88, y: 588, width: 666, height: 55, label: 'Pick the next move' },
    bullets: ['Map papers to concepts', 'Inspect typed edges', 'Repair prerequisites'],
  },
  {
    eyebrow: 'Step 3',
    title: 'Open a notebook and move through the learning contract.',
    body: 'Each serious page is built around the same rhythm: intuition, math, runnable code, and an interactive demo that tests the mechanism.',
    image: 'attention-notebook.png',
    accent: '#117987',
    step: '04',
    focus: { x: 874, y: 646, width: 574, height: 288, label: 'Intuition -> Math -> Code -> Demo' },
    bullets: ['Read the intuition', 'Match the symbols', 'Run the witness', 'Manipulate the demo'],
  },
  {
    eyebrow: 'Step 4',
    title: 'Follow a route when one page is not enough.',
    body: 'Curated modules keep the question alive across pages. For attention serving, the path moves from QK^T to KV cache memory, GQA/MQA, long context, and latency.',
    image: 'serving-path.png',
    accent: '#7c5a1f',
    step: '05',
    focus: { x: 440, y: 798, width: 696, height: 198, label: 'A connected route' },
    bullets: ['Carry equations forward', 'Compare tradeoffs', 'Keep one route in view'],
  },
  {
    eyebrow: 'How To Use It',
    title: 'Use it as a study desk, lab bench, and research tutor.',
    body: 'Pick a question, commit a prediction, inspect what changed, then ask the companion to connect the result to the next concept or paper claim.',
    image: 'home.png',
    accent: '#1f2937',
    step: '06',
    focus: { x: 1250, y: 494, width: 196, height: 236, label: 'Turn the route into synthesis' },
    bullets: ['Choose a live question', 'Predict before reveal', 'Save the invariant', 'Continue the route'],
  },
]

const baseText: CSSProperties = {
  color: '#17202b',
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  letterSpacing: 0,
}

export const ContinuousFunctionTour = () => {
  return (
    <AbsoluteFill style={{ background: '#f4eee3' }}>
      <Texture />
      {scenes.map((scene, index) => (
        <Sequence
          key={scene.step}
          from={index * SCENE_FRAMES}
          durationInFrames={SCENE_FRAMES}
          premountFor={30}
        >
          <Scene scene={scene} isLast={index === scenes.length - 1} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}

const Scene = ({ scene, isLast }: { scene: TourScene; isLast: boolean }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = interpolate(frame, [0, 0.6 * fps], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  })
  const exit = isLast
    ? 1
    : interpolate(frame, [SCENE_FRAMES - 0.7 * fps, SCENE_FRAMES - 0.15 * fps], [1, 0], {
        ...clamp,
        easing: Easing.in(Easing.cubic),
      })
  const progress = interpolate(frame, [0, SCENE_FRAMES], [0, 1], clamp)
  const imageScale = interpolate(progress, [0, 1], [1.015, 1.06], clamp)
  const textX = interpolate(enter, [0, 1], [-34, 0], clamp)
  const focusPulse = 0.55 + 0.45 * Math.sin(frame / 8)

  return (
    <AbsoluteFill style={{ opacity: enter * exit }}>
      <div style={frameStyle(scene.accent, imageScale)}>
        <Img
          src={staticFile(`video/continuous-function-tour/${scene.image}`)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${imageScale})`,
          }}
        />
        <div style={browserBarStyle}>
          <span />
          <span />
          <span />
          <strong>localhost:3000</strong>
        </div>
        {scene.focus ? <FocusOverlay focus={scene.focus} accent={scene.accent} pulse={focusPulse} /> : null}
      </div>

      <div style={copyPanelStyle(textX)}>
        <div style={sceneHeaderStyle}>
          <span style={{ ...stepStyle, color: scene.accent }}>{scene.step}</span>
          <span style={{ ...eyebrowStyle, color: scene.accent }}>{scene.eyebrow}</span>
        </div>
        <h1 style={titleStyle}>{scene.title}</h1>
        <p style={bodyStyle}>{scene.body}</p>
        <div style={bulletGridStyle}>
          {scene.bullets.map((bullet) => (
            <div key={bullet} style={bulletStyle(scene.accent)}>
              {bullet}
            </div>
          ))}
        </div>
      </div>

      <div style={footerStyle}>
        <strong>Continuous Function</strong>
        <span>Intuition {'->'} Math {'->'} Code {'->'} Interactive Demo</span>
      </div>
    </AbsoluteFill>
  )
}

const Texture = () => (
  <AbsoluteFill
    style={{
      background:
        'linear-gradient(90deg, rgba(23,32,43,0.055) 1px, transparent 1px), linear-gradient(180deg, rgba(23,32,43,0.055) 1px, transparent 1px)',
      backgroundSize: '44px 44px',
      opacity: 0.44,
    }}
  />
)

const FocusOverlay = ({ focus, accent, pulse }: { focus: FocusBox; accent: string; pulse: number }) => {
  const scaleX = IMAGE_WIDTH / 1600
  const scaleY = IMAGE_HEIGHT / 1000

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: focus.x * scaleX,
          top: focus.y * scaleY + 34,
          width: focus.width * scaleX,
          height: focus.height * scaleY,
          border: `4px solid ${accent}`,
          borderRadius: 20,
          boxShadow: `0 0 0 ${8 + pulse * 8}px rgba(255, 255, 255, 0.48), 0 18px 48px rgba(17, 24, 39, 0.24)`,
        }}
      />
      <div
        style={{
          ...baseText,
          position: 'absolute',
          left: focus.x * scaleX,
          top: focus.y * scaleY - 30,
          padding: '10px 14px',
          borderRadius: 999,
          color: '#fffaf0',
          background: accent,
          fontSize: 21,
          fontWeight: 800,
          boxShadow: '0 16px 34px rgba(17, 24, 39, 0.22)',
        }}
      >
        {focus.label}
      </div>
    </>
  )
}

const frameStyle = (accent: string, scale: number): CSSProperties => ({
  position: 'absolute',
  left: IMAGE_LEFT,
  top: IMAGE_TOP,
  width: IMAGE_WIDTH,
  height: IMAGE_HEIGHT,
  overflow: 'hidden',
  borderRadius: 32,
  border: '1px solid rgba(23, 32, 43, 0.12)',
  background: '#fffaf0',
  boxShadow: `0 42px 90px rgba(23, 32, 43, 0.22), 0 0 0 ${Math.round(10 * scale)}px ${accent}16`,
})

const browserBarStyle: CSSProperties = {
  ...baseText,
  position: 'absolute',
  left: 0,
  top: 0,
  right: 0,
  height: 34,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '0 16px',
  background: 'rgba(255, 250, 240, 0.92)',
  borderBottom: '1px solid rgba(23, 32, 43, 0.1)',
  fontSize: 14,
}

const copyPanelStyle = (x: number): CSSProperties => ({
  ...baseText,
  position: 'absolute',
  left: 76 + x,
  top: 174,
  width: 618,
  padding: '52px 52px 46px',
  borderRadius: 28,
  border: '1px solid rgba(23, 32, 43, 0.12)',
  background: 'rgba(255, 250, 240, 0.93)',
  boxShadow: '0 32px 80px rgba(23, 32, 43, 0.18)',
})

const sceneHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  marginBottom: 26,
}

const stepStyle: CSSProperties = {
  ...baseText,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: 28,
  fontWeight: 900,
}

const eyebrowStyle: CSSProperties = {
  ...baseText,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: 20,
  fontWeight: 800,
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  ...baseText,
  margin: 0,
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 62,
  lineHeight: 1.02,
  fontWeight: 900,
}

const bodyStyle: CSSProperties = {
  ...baseText,
  margin: '26px 0 0',
  fontSize: 28,
  lineHeight: 1.42,
  color: '#405062',
}

const bulletGridStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  marginTop: 34,
}

const bulletStyle = (accent: string): CSSProperties => ({
  ...baseText,
  padding: '12px 16px',
  borderRadius: 999,
  border: `1px solid ${accent}33`,
  background: '#fffaf0',
  color: '#17202b',
  fontSize: 20,
  fontWeight: 800,
})

const footerStyle: CSSProperties = {
  ...baseText,
  position: 'absolute',
  left: 76,
  right: 76,
  bottom: 44,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  color: '#405062',
  fontSize: 22,
}
