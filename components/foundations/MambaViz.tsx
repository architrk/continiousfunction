import { useEffect, useMemo, useState } from 'react'
import TimeSeriesPlot from '../TimeSeriesPlot'
import { TimeSeries, MATH_COLORS } from '../../lib/mathObjects'

// Gamification types
type GamePhase = 'setup' | 'countdown' | 'revealed'
type RecoveryPrediction = 'mamba' | 'lti' | 'tie' | null

// Mystery challenges for the prediction game
const RECOVERY_CHALLENGES = [
  {
    name: '🎲 Standard Noise',
    patternIndex: 0,
    presetIndex: 1,
    answer: 'mamba' as const,
    description: 'Password buried in noise - which model filters better?',
  },
  {
    name: '🎲 Leaky Gates',
    patternIndex: 0,
    presetIndex: 2,
    answer: 'tie' as const,
    description: 'When gates leak, does selectivity still help?',
  },
  {
    name: '🎲 LTI Mode',
    patternIndex: 0,
    presetIndex: 3,
    answer: 'tie' as const,
    description: 'Same gate everywhere - what happens?',
  },
  {
    name: '🎲 Two Passwords',
    patternIndex: 2,
    presetIndex: 0,
    answer: 'mamba' as const,
    description: 'Can Mamba track multiple critical sequences?',
  },
  {
    name: '🎲 Early Password',
    patternIndex: 1,
    presetIndex: 1,
    answer: 'mamba' as const,
    description: 'Password at the start with trailing noise...',
  },
];

// Feedback based on prediction accuracy
const getRecoveryFeedback = (
  predicted: RecoveryPrediction,
  actual: string,
  mambaScore: { correct: number; incorrect: number },
  ltiScore: { correct: number; incorrect: number },
  presetName: string
): string => {
  const correct = predicted === actual;
  const _mambaNet = mambaScore.correct - mambaScore.incorrect;
  const _ltiNet = ltiScore.correct - ltiScore.incorrect;

  if (correct) {
    if (actual === 'mamba') {
      return `🎯 Correct! Mamba (${mambaScore.correct}/${mambaScore.correct + mambaScore.incorrect} clean) beats LTI (${ltiScore.correct}/${ltiScore.correct + ltiScore.incorrect} with ${ltiScore.incorrect} false positives). The selective Δ gate filters noise while preserving password tokens!`;
    }
    if (actual === 'tie') {
      return `🎯 Correct! With "${presetName}", both models perform similarly. When gates don't differentiate by content, selectivity provides no advantage - this is why Mamba's input-dependent Δ matters!`;
    }
    return `🎯 Correct! Surprisingly, LTI wins in this configuration. This is rare and usually means the selective gates are misconfigured.`;
  }

  // Wrong prediction
  if (actual === 'mamba') {
    return `❌ Mamba wins! It correctly identified ${mambaScore.correct} password tokens with ${mambaScore.incorrect} false positives, while LTI had ${ltiScore.incorrect} spurious activations. The input-dependent Δ is the key difference.`;
  }
  if (actual === 'tie') {
    return `❌ It's a tie! With "${presetName}", Mamba's advantage disappears because all tokens get similar gates. This demonstrates why content-dependent gating is crucial for selective memory.`;
  }
  return `❌ LTI actually wins in this unusual case. The preset configuration isn't helping Mamba differentiate well.`;
};

type TokenKind = 'noise' | 'password' | 'marker'

interface Token {
  id: number
  text: string
  kind: TokenKind
}

interface PatternConfig {
  id: string
  name: string
  description: string
  tokens: Token[]
}

interface ScanLevel {
  level: number
  segments: { start: number; end: number }[]
}

// --- Selectivity presets --------------------------------------------------------

type SelectivityPreset = {
  name: string
  noiseGate: number
  markerGate: number
  passwordGate: number
  description: string
}

const SELECTIVITY_PRESETS: SelectivityPreset[] = [
  { name: '🎯 Highly Selective', noiseGate: 0.02, markerGate: 0.2, passwordGate: 0.95, description: 'Almost zero update on noise, max on password' },
  { name: '⚖️ Balanced', noiseGate: 0.05, markerGate: 0.4, passwordGate: 0.9, description: 'Standard Mamba-like behavior' },
  { name: '💧 Leaky', noiseGate: 0.3, markerGate: 0.5, passwordGate: 0.7, description: 'Noise leaks through (less selective)' },
  { name: '🔄 LTI-like', noiseGate: 0.6, markerGate: 0.6, passwordGate: 0.6, description: 'Same gate everywhere (defeats the purpose!)' },
]

// --- Dynamic educational insight ------------------------------------------------

function getMambaInsight(
  currentStep: number,
  tokens: Token[],
  deltas: number[],
  ltiState: number[],
  selectiveState: number[]
): string {
  const token = tokens[currentStep]
  const delta = deltas[currentStep]

  if (currentStep === 0) {
    return '🚀 Starting the sequence! Watch how Δ (delta) bars vary by token type. Large Δ = strong update, small Δ = mostly copy previous state.';
  }

  if (token?.kind === 'password') {
    return `✨ PASSWORD TOKEN! Δ = ${delta.toFixed(2)} → This token gets written strongly into the state. Notice the Mamba line jumps up while LTI only changes slightly.`;
  }

  if (token?.kind === 'marker') {
    return `📍 Marker token [${token.text}]. Δ = ${delta.toFixed(2)}. Markers help the model know when password starts/ends, but aren't stored as strongly.`;
  }

  if (token?.kind === 'noise') {
    const ltiDiff = Math.abs(ltiState[currentStep] - ltiState[currentStep - 1]);
    const selectiveDiff = Math.abs(selectiveState[currentStep] - selectiveState[currentStep - 1]);

    if (selectiveDiff < ltiDiff * 0.3) {
      return `🔕 NOISE FILTERED! Δ = ${delta.toFixed(2)} → Mamba barely updates (Δh ≈ ${selectiveDiff.toFixed(3)}), while LTI blindly accumulates (Δh ≈ ${ltiDiff.toFixed(3)}). This is selective memory in action!`;
    }
    return `🔇 Noise token. Δ = ${delta.toFixed(2)} → Small update keeps the state mostly unchanged. The password stays preserved in memory.`;
  }

  return `📊 Step ${currentStep}: Δ = ${delta.toFixed(2)}. Compare how LTI (gray) and Mamba (teal) evolve differently!`;
}

// --- Input patterns ---------------------------------------------------------

const PATTERNS: PatternConfig[] = [
  {
    id: 'middle',
    name: 'Password in the middle',
    description: 'Noise → [password] → noise',
    tokens: [
      { id: 0, text: 'r', kind: 'noise' },
      { id: 1, text: '?', kind: 'noise' },
      { id: 2, text: '[', kind: 'marker' },
      { id: 3, text: '4', kind: 'password' },
      { id: 4, text: '2', kind: 'password' },
      { id: 5, text: '7', kind: 'password' },
      { id: 6, text: '9', kind: 'password' },
      { id: 7, text: ']', kind: 'marker' },
      { id: 8, text: '#', kind: 'noise' },
      { id: 9, text: 'k', kind: 'noise' },
    ],
  },
  {
    id: 'early',
    name: 'Password at the start',
    description: '[password] → trailing noise',
    tokens: [
      { id: 0, text: '[', kind: 'marker' },
      { id: 1, text: '4', kind: 'password' },
      { id: 2, text: '2', kind: 'password' },
      { id: 3, text: '7', kind: 'password' },
      { id: 4, text: '9', kind: 'password' },
      { id: 5, text: ']', kind: 'marker' },
      { id: 6, text: 'x', kind: 'noise' },
      { id: 7, text: '?', kind: 'noise' },
      { id: 8, text: 'q', kind: 'noise' },
      { id: 9, text: '%', kind: 'noise' },
    ],
  },
  {
    id: 'two',
    name: 'Two passwords',
    description: 'Noise → [password] → noise → [password]',
    tokens: [
      { id: 0, text: 'x', kind: 'noise' },
      { id: 1, text: 'q', kind: 'noise' },
      { id: 2, text: '[', kind: 'marker' },
      { id: 3, text: '4', kind: 'password' },
      { id: 4, text: '2', kind: 'password' },
      { id: 5, text: '7', kind: 'password' },
      { id: 6, text: '9', kind: 'password' },
      { id: 7, text: ']', kind: 'marker' },
      { id: 8, text: 'z', kind: 'noise' },
      { id: 9, text: '[', kind: 'marker' },
      { id: 10, text: '4', kind: 'password' },
      { id: 11, text: '2', kind: 'password' },
      { id: 12, text: '7', kind: 'password' },
      { id: 13, text: '9', kind: 'password' },
      { id: 14, text: ']', kind: 'marker' },
    ],
  },
]

// --- Small helpers ---------------------------------------------------------

function deltaForToken(token: Token, preset: SelectivityPreset): number {
  switch (token.kind) {
    case 'password':
      return preset.passwordGate
    case 'marker':
      return preset.markerGate
    case 'noise':
    default:
      return preset.noiseGate
  }
}

function computeDeltas(tokens: Token[], preset: SelectivityPreset): number[] {
  return tokens.map(t => deltaForToken(t, preset))
}

// Simple LTI SSM: h_{t+1} = λ h_t + β x_t with fixed parameters
function simulateLTI(tokens: Token[]): number[] {
  const lambda = 0.85
  const betaNoise = 0.05
  const betaMarker = 0.1
  const betaPassword = 0.35

  let h = 0
  const states: number[] = []

  for (const token of tokens) {
    let beta = betaNoise
    if (token.kind === 'password') beta = betaPassword
    else if (token.kind === 'marker') beta = betaMarker
    h = lambda * h + beta
    states.push(h)
  }

  return states
}

// Selective (Mamba-style) update: h_{t+1} = (1 - Δ_t) h_t + Δ_t * x_t, with input-dependent Δ_t
function simulateSelective(tokens: Token[], deltas: number[]): number[] {
  let h = 0
  const states: number[] = []

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const delta = deltas[i]
    const x = token.kind === 'password' ? 1 : 0 // toy scalar input
    h = (1 - delta) * h + delta * x
    states.push(h)
  }

  return states
}

function computeSelections(tokens: Token[], lti: number[], deltas: number[]) {
  const maxLti = Math.max(...lti, 1e-6)
  const ltiThreshold = maxLti * 0.6

  const ltiSelected = tokens.map(
    (t, i) => t.kind !== 'marker' && lti[i] > ltiThreshold
  )

  const gateThreshold = 0.5
  const mambaSelected = tokens.map(
    (t, i) => t.kind === 'password' && deltas[i] > gateThreshold
  )

  return { ltiSelected, mambaSelected }
}

// Parallel scan levels: each level doubles the segment length
function computeScanLevels(length: number): ScanLevel[] {
  const levels: ScanLevel[] = []
  let segmentSize = 1
  let level = 0

  while (segmentSize < length) {
    const segments: { start: number; end: number }[] = []
    for (let start = 0; start < length; start += segmentSize * 2) {
      const end = Math.min(start + segmentSize * 2 - 1, length - 1)
      if (end >= start) {
        segments.push({ start, end })
      }
    }
    levels.push({ level, segments })
    segmentSize *= 2
    level += 1
  }

  return levels
}

// --- Main component --------------------------------------------------------

export default function MambaSelectiveStateSpaceDemo() {
  const [patternIndex, setPatternIndex] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)
  const [showScan, setShowScan] = useState(false)
  const [activeScanLevel, setActiveScanLevel] = useState(0)
  const [selectivityPresetIndex, setSelectivityPresetIndex] = useState(1) // Balanced by default

  // Game state
  const [gameMode, setGameMode] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [selectedChallenge, setSelectedChallenge] = useState<typeof RECOVERY_CHALLENGES[0] | null>(null)
  const [prediction, setPrediction] = useState<RecoveryPrediction>(null)
  const [countdown, setCountdown] = useState(3)
  const [score, setScore] = useState({ correct: 0, total: 0 })

  const pattern = PATTERNS[patternIndex]
  const tokens = pattern.tokens
  const selectivityPreset = SELECTIVITY_PRESETS[selectivityPresetIndex]

  const deltas = useMemo(() => computeDeltas(tokens, selectivityPreset), [tokens, selectivityPreset])
  const ltiState = useMemo(() => simulateLTI(tokens), [tokens])
  const selectiveState = useMemo(
    () => simulateSelective(tokens, deltas),
    [tokens, deltas]
  )

  const { ltiSelected, mambaSelected } = useMemo(
    () => computeSelections(tokens, ltiState, deltas),
    [tokens, ltiState, deltas]
  )

  const timeSeries: TimeSeries[] = useMemo(
    () => [
      {
        label: 'LTI state',
        color: '#6b7280', // gray
        data: ltiState.map((value, t) => ({ t, value })),
      },
      {
        label: 'Selective (Mamba) state',
        color: MATH_COLORS.secondary, // teal
        data: selectiveState.map((value, t) => ({ t, value })),
      },
    ],
    [ltiState, selectiveState]
  )

  const scanLevels = useMemo(
    () => computeScanLevels(tokens.length),
    [tokens.length]
  )

  // Dynamic educational insight
  const currentInsight = useMemo(() => {
    return getMambaInsight(currentStep, tokens, deltas, ltiState, selectiveState);
  }, [currentStep, tokens, deltas, ltiState, selectiveState]);

  // Compute password recovery accuracy
  const passwordAccuracy = useMemo(() => {
    const passwordTokens = tokens.filter(t => t.kind === 'password');
    const correctMamba = mambaSelected.filter((sel, i) => sel && tokens[i].kind === 'password').length;
    const incorrectMamba = mambaSelected.filter((sel, i) => sel && tokens[i].kind !== 'password').length;
    const correctLti = ltiSelected.filter((sel, i) => sel && tokens[i].kind === 'password').length;
    const incorrectLti = ltiSelected.filter((sel, i) => sel && tokens[i].kind !== 'password').length;

    return {
      mamba: { correct: correctMamba, incorrect: incorrectMamba, total: passwordTokens.length },
      lti: { correct: correctLti, incorrect: incorrectLti, total: passwordTokens.length },
    };
  }, [tokens, mambaSelected, ltiSelected]);

  // Game control functions
  const startChallenge = (challenge: typeof RECOVERY_CHALLENGES[0]) => {
    setSelectedChallenge(challenge);
    setPrediction(null);
    setGamePhase('setup');
    setCurrentStep(0);
  };

  const submitPrediction = (pred: RecoveryPrediction) => {
    if (!selectedChallenge || !pred) return;
    setPrediction(pred);
    setGamePhase('countdown');
    setCountdown(3);
  };

  const resetGame = () => {
    setGamePhase('setup');
    setSelectedChallenge(null);
    setPrediction(null);
    setCurrentStep(0);
  };

  // Countdown effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Reveal phase - apply the challenge parameters
          if (selectedChallenge) {
            setPatternIndex(selectedChallenge.patternIndex);
            setSelectivityPresetIndex(selectedChallenge.presetIndex);
            setCurrentStep(0);

            // Update score
            const correct = prediction === selectedChallenge.answer;
            setScore(prev => ({
              correct: prev.correct + (correct ? 1 : 0),
              total: prev.total + 1,
            }));
          }
          setGamePhase('revealed');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gamePhase, selectedChallenge, prediction]);

  useEffect(() => {
    // Reset when pattern changes
    setCurrentStep(0)
    setActiveScanLevel(0)
  }, [patternIndex, tokens.length])

  const maxStep = Math.max(tokens.length - 1, 0)

  return (
    <section
      className="card interactive-card"
      style={{
        backgroundColor: '#080c14',
        borderColor: 'rgba(148, 163, 184, 0.3)',
      }}
    >
      <div className="mamba-header">
        <h2>Mamba&apos;s Selective State Space (Toy Demo)</h2>
        <p className="muted">
          Unlike S4 with fixed A, B, C, this toy Mamba uses input-dependent
          B, C, and Δ. Large Δ focuses on the current token; small Δ
          mostly copies the previous state.
        </p>

        {/* Game Mode Toggle */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
          <button
            onClick={() => {
              setGameMode(!gameMode);
              if (!gameMode) resetGame();
            }}
            style={{
              fontSize: '0.72rem',
              padding: '0.25rem 0.75rem',
              borderRadius: '999px',
              border: gameMode ? '1px solid #14b8a6' : '1px solid #374151',
              background: gameMode
                ? 'linear-gradient(135deg, rgba(20, 184, 166, 0.2), rgba(20, 184, 166, 0.1))'
                : 'rgba(15, 23, 42, 0.9)',
              color: gameMode ? '#5eead4' : '#e5e7eb',
              cursor: 'pointer',
              fontWeight: gameMode ? 600 : 400,
            }}
          >
            {gameMode ? '🎮 Challenge Mode' : '🎮 Try Challenge'}
          </button>
          {gameMode && score.total > 0 && (
            <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
              Score: {score.correct}/{score.total}
            </span>
          )}
        </div>

        {/* Game Panel */}
        {gameMode && (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            borderRadius: '0.625rem',
            background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.1), rgba(245, 158, 11, 0.1))',
            border: '1px solid rgba(20, 184, 166, 0.3)',
          }}>
            {gamePhase === 'setup' && !selectedChallenge && (
              <>
                <p style={{ fontSize: '0.75rem', color: '#5eead4', marginBottom: '0.5rem', fontWeight: 600 }}>
                  🎯 Password Recovery Challenge
                </p>
                <p style={{ fontSize: '0.68rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                  Which model will better recover the password from noise?
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {RECOVERY_CHALLENGES.map((challenge) => (
                    <button
                      key={challenge.name}
                      onClick={() => startChallenge(challenge)}
                      title={challenge.description}
                      style={{
                        fontSize: '0.68rem',
                        padding: '0.35rem 0.6rem',
                        borderRadius: '0.375rem',
                        border: '1px solid #374151',
                        background: 'rgba(15, 23, 42, 0.9)',
                        color: '#e5e7eb',
                        cursor: 'pointer',
                      }}
                    >
                      {challenge.name}
                    </button>
                  ))}
                </div>
              </>
            )}

            {gamePhase === 'setup' && selectedChallenge && (
              <>
                <p style={{ fontSize: '0.75rem', color: '#5eead4', marginBottom: '0.35rem', fontWeight: 600 }}>
                  {selectedChallenge.name}
                </p>
                <p style={{ fontSize: '0.68rem', color: '#9ca3af', marginBottom: '0.6rem' }}>
                  {selectedChallenge.description}
                </p>
                <p style={{ fontSize: '0.68rem', color: '#e5e7eb', marginBottom: '0.5rem' }}>
                  Which model will better extract the password?
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => submitPrediction('mamba')}
                    style={{
                      fontSize: '0.68rem',
                      padding: '0.5rem 0.85rem',
                      borderRadius: '0.375rem',
                      border: '1px solid #14b8a6',
                      background: 'rgba(20, 184, 166, 0.15)',
                      color: '#14b8a6',
                      cursor: 'pointer',
                    }}
                  >
                    🧬 Mamba (Selective)
                  </button>
                  <button
                    onClick={() => submitPrediction('lti')}
                    style={{
                      fontSize: '0.68rem',
                      padding: '0.5rem 0.85rem',
                      borderRadius: '0.375rem',
                      border: '1px solid #6b7280',
                      background: 'rgba(107, 114, 128, 0.15)',
                      color: '#9ca3af',
                      cursor: 'pointer',
                    }}
                  >
                    📊 LTI (Fixed)
                  </button>
                  <button
                    onClick={() => submitPrediction('tie')}
                    style={{
                      fontSize: '0.68rem',
                      padding: '0.5rem 0.85rem',
                      borderRadius: '0.375rem',
                      border: '1px solid #f59e0b',
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#f59e0b',
                      cursor: 'pointer',
                    }}
                  >
                    🤝 Tie
                  </button>
                </div>
              </>
            )}

            {gamePhase === 'countdown' && (
              <div style={{ textAlign: 'center', padding: '1.25rem 0' }}>
                <p style={{ fontSize: '0.85rem', color: '#5eead4', marginBottom: '0.5rem' }}>
                  You predicted: <strong>{prediction === 'mamba' ? 'Mamba' : prediction === 'lti' ? 'LTI' : 'Tie'}</strong>
                </p>
                <p style={{ fontSize: '2rem', color: '#e5e7eb', fontWeight: 700 }}>
                  {countdown}
                </p>
                <p style={{ fontSize: '0.68rem', color: '#9ca3af' }}>Running simulation...</p>
              </div>
            )}

            {gamePhase === 'revealed' && selectedChallenge && (
              <>
                <div style={{
                  padding: '0.6rem',
                  borderRadius: '0.5rem',
                  background: prediction === selectedChallenge.answer
                    ? 'rgba(34, 197, 94, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                  border: prediction === selectedChallenge.answer
                    ? '1px solid rgba(34, 197, 94, 0.3)'
                    : '1px solid rgba(239, 68, 68, 0.3)',
                  marginBottom: '0.6rem',
                }}>
                  <p style={{ fontSize: '0.72rem', color: '#e5e7eb', lineHeight: 1.5 }}>
                    {getRecoveryFeedback(
                      prediction,
                      selectedChallenge.answer,
                      passwordAccuracy.mamba,
                      passwordAccuracy.lti,
                      SELECTIVITY_PRESETS[selectedChallenge.presetIndex].name
                    )}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.68rem', color: '#9ca3af', marginBottom: '0.6rem' }}>
                  <span>Pattern: {PATTERNS[selectedChallenge.patternIndex].name}</span>
                  <span>Preset: {SELECTIVITY_PRESETS[selectedChallenge.presetIndex].name}</span>
                </div>
                <button
                  onClick={resetGame}
                  style={{
                    fontSize: '0.68rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #374151',
                    background: 'rgba(15, 23, 42, 0.9)',
                    color: '#e5e7eb',
                    cursor: 'pointer',
                  }}
                >
                  Try Another
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div
        className="mamba-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1.4fr)',
          gap: '1.5rem',
          alignItems: 'flex-start',
        }}
      >
        {/* Left: controls + sequence + Δ visualization */}
        <div className="mamba-left">
          <div
            className="mamba-controls"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                fontSize: '0.875rem',
                color: '#e5e7eb',
              }}
            >
              Input pattern
              <select
                value={patternIndex}
                onChange={(e) => setPatternIndex(Number(e.target.value))}
                style={{
                  backgroundColor: '#020617',
                  borderRadius: '0.5rem',
                  border: '1px solid #374151',
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.875rem',
                  color: '#e5e7eb',
                }}
              >
                {PATTERNS.map((p, idx) => (
                  <option key={p.id} value={idx}>
                    {p.name}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                {pattern.description}
              </span>
            </label>

            {/* Selectivity Presets */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {SELECTIVITY_PRESETS.map((preset, idx) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setSelectivityPresetIndex(idx)}
                  title={preset.description}
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '999px',
                    border: idx === selectivityPresetIndex
                      ? '1px solid #14b8a6'
                      : '1px solid #374151',
                    background: idx === selectivityPresetIndex
                      ? 'rgba(20, 184, 166, 0.2)'
                      : 'rgba(15, 23, 42, 0.9)',
                    color: idx === selectivityPresetIndex
                      ? '#5eead4'
                      : '#e5e7eb',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-out',
                  }}
                >
                  {preset.name}
                </button>
              ))}
            </div>

            {/* Dynamic Insight Box */}
            <div
              style={{
                padding: '0.5rem 0.65rem',
                borderRadius: '0.5rem',
                background: tokens[currentStep]?.kind === 'password'
                  ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))'
                  : 'linear-gradient(135deg, rgba(96, 165, 250, 0.15), rgba(59, 130, 246, 0.05))',
                border: tokens[currentStep]?.kind === 'password'
                  ? '1px solid rgba(245, 158, 11, 0.3)'
                  : '1px solid rgba(96, 165, 250, 0.3)',
                fontSize: '0.72rem',
                color: 'rgba(255, 255, 255, 0.9)',
                lineHeight: 1.5,
              }}
            >
              {currentInsight}
            </div>

            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                fontSize: '0.875rem',
                color: '#e5e7eb',
              }}
            >
              Step through the sequence (t = {currentStep})
              <input
                type="range"
                min={0}
                max={maxStep || 0}
                value={currentStep}
                onChange={(e) => setCurrentStep(Number(e.target.value))}
              />
            </label>
          </div>

          {/* Token row + Δ bars */}
          <div
            className="mamba-sequence"
            style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto' }}
          >
            {tokens.map((token, idx) => {
              const delta = deltas[idx]
              const isCurrent = idx === currentStep
              const baseBg =
                token.kind === 'password'
                  ? MATH_COLORS.primary
                  : token.kind === 'noise'
                  ? '#111827'
                  : '#1f2937'
              const textColor =
                token.kind === 'password' ? '#111827' : '#e5e7eb'
              const borderColor = isCurrent ? MATH_COLORS.secondary : '#374151'
              const boxShadow = isCurrent
                ? '0 0 16px rgba(20, 184, 166, 0.9)'
                : 'none'
              const barHeight = 8 + delta * 52 // 8–60 px

              return (
                <div
                  key={`${pattern.id}-${token.id}`}
                  style={{
                    minWidth: '40px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  {/* Δ bar */}
                  <div
                    aria-label={`Delta for token ${idx}: ${delta.toFixed(2)}`}
                    style={{
                      width: '10px',
                      height: `${barHeight}px`,
                      borderRadius: '999px',
                      background:
                        token.kind === 'password'
                          ? 'linear-gradient(to top, #f97316, #facc15)'
                          : 'linear-gradient(to top, #4b5563, #9ca3af)',
                      opacity: token.kind === 'noise' ? 0.85 : 1,
                    }}
                  />
                  {/* Token pill */}
                  <div
                    style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: '999px',
                      backgroundColor: baseBg,
                      color: textColor,
                      border: `1px solid ${borderColor}`,
                      boxShadow,
                      fontSize: '0.875rem',
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {token.text}
                  </div>
                  {/* Kind / Δ label */}
                  <div
                    style={{
                      fontSize: '0.7rem',
                      color: '#9ca3af',
                      textAlign: 'center',
                    }}
                  >
                    Δ={delta.toFixed(2)}
                  </div>
                </div>
              )
            })}
          </div>

          <p
            style={{
              marginTop: '0.75rem',
              fontSize: '0.75rem',
              color: '#9ca3af',
            }}
          >
            Orange tokens are the password. Δ bars rise sharply on those tokens
            (selective update) and stay small on gray noise tokens (copy state).
          </p>
        </div>

        {/* Right: hidden state + selective copying task */}
        <div className="mamba-right" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="mamba-state-chart">
            <TimeSeriesPlot
              series={timeSeries}
              width={420}
              height={240}
              xLabel="time step t"
              yLabel="hidden state h_t"
              showLegend={true}
              currentTime={currentStep}
              animate={false}
            />
            <p
              style={{
                marginTop: '0.5rem',
                fontSize: '0.75rem',
                color: '#9ca3af',
              }}
            >
              LTI: fixed dynamics blurs everything together.
              Selective Mamba: big jumps only on orange password
              tokens, tiny changes on gray noise → memory is used where it matters.
            </p>
          </div>

          {/* Selective copying task */}
          <div
            className="mamba-copy-task"
            style={{
              borderRadius: '0.75rem',
              border: '1px solid #374151',
              padding: '0.75rem 0.9rem',
              background:
                'linear-gradient(to bottom right, rgba(15,23,42,0.9), rgba(15,23,42,0.6))',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
                gap: '0.5rem',
              }}
            >
              <strong style={{ fontSize: '0.875rem', color: '#e5e7eb' }}>
                Selective Copying: recover the password, ignore noise
              </strong>
              <span
                style={{
                  fontSize: '0.7rem',
                  color: '#9ca3af',
                  whiteSpace: 'nowrap',
                }}
              >
                Output length = password length
              </span>
            </div>

            {/* Input row */}
            <Row
              label="Input"
              tokens={tokens}
              selected={tokens.map((t) => t.kind === 'password')}
              mode="input"
            />

            {/* LTI output row */}
            <Row
              label="LTI output"
              tokens={tokens}
              selected={ltiSelected}
              mode="lti"
            />

            {/* Selective Mamba output row */}
            <Row
              label="Selective (Mamba)"
              tokens={tokens}
              selected={mambaSelected}
              mode="mamba"
            />

            <p
              style={{
                marginTop: '0.5rem',
                fontSize: '0.75rem',
                color: '#9ca3af',
              }}
            >
              LTI (fixed A, B, C) tends to light up extra nearby tokens and
              leak across noise. The selective model uses Δ as a gate so only
              the password tokens are copied out cleanly.
            </p>
          </div>
        </div>
      </div>

      {/* Optional advanced view: parallel scan animation */}
      <div
        className="mamba-scan-advanced"
        style={{ marginTop: '1.5rem', borderTop: '1px solid #1f2937', paddingTop: '1rem' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '0.5rem',
          }}
        >
          <button
            type="button"
            onClick={() => setShowScan((s) => !s)}
            style={{
              fontSize: '0.8rem',
              padding: '0.25rem 0.6rem',
              borderRadius: '999px',
              border: '1px solid #4b5563',
              backgroundColor: showScan ? '#0f172a' : '#020617',
              color: '#e5e7eb',
            }}
          >
            {showScan ? 'Hide' : 'Show'} parallel scan (advanced)
          </button>
          {showScan && (
            <>
              <button
                type="button"
                onClick={() =>
                  setActiveScanLevel((l) => Math.max(l - 1, 0))
                }
                style={{
                  fontSize: '0.8rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  border: '1px solid #4b5563',
                  backgroundColor: '#020617',
                  color: '#e5e7eb',
                }}
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() =>
                  setActiveScanLevel((l) =>
                    Math.min(l + 1, Math.max(scanLevels.length - 1, 0))
                  )
                }
                style={{
                  fontSize: '0.8rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  border: '1px solid #4b5563',
                  backgroundColor: '#020617',
                  color: '#e5e7eb',
                }}
              >
                ▶
              </button>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                Phase {scanLevels.length === 0 ? 0 : activeScanLevel + 1} of{' '}
                {scanLevels.length || 1}
              </span>
            </>
          )}
        </div>

        {showScan && (
          <div
            style={{
              borderRadius: '0.75rem',
              border: '1px solid #1f2937',
              padding: '0.75rem 0.9rem',
              background:
                'linear-gradient(to right, rgba(15,23,42,0.9), rgba(15,23,42,0.8))',
            }}
          >
            <p
              style={{
                fontSize: '0.75rem',
                color: '#9ca3af',
                marginBottom: '0.75rem',
              }}
            >
              The state-space recurrence can be evaluated in parallel with a
              scan: each phase combines longer and longer spans of tokens.
              All segments in the same row can be computed simultaneously.
            </p>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              {scanLevels.map((level, idx) => {
                const isActive = idx === activeScanLevel
                const isPast = idx < activeScanLevel

                return (
                  <div key={level.level} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div
                      style={{
                        width: '90px',
                        fontSize: '0.7rem',
                        color: isActive
                          ? MATH_COLORS.secondary
                          : '#9ca3af',
                      }}
                    >
                      Phase {idx + 1}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        display: 'grid',
                        gridTemplateColumns: `repeat(${tokens.length}, minmax(0, 1fr))`,
                        gap: '2px',
                      }}
                    >
                      {level.segments.map((seg) => (
                        <div
                          key={`${level.level}-${seg.start}-${seg.end}`}
                          style={{
                            gridColumn: `${seg.start + 1} / ${seg.end + 2}`,
                            height: '12px',
                            borderRadius: '999px',
                            backgroundColor: isActive
                              ? 'rgba(20, 184, 166, 0.9)'
                              : isPast
                              ? 'rgba(20, 184, 166, 0.4)'
                              : 'rgba(148, 163, 184, 0.4)',
                            boxShadow: isActive
                              ? '0 0 12px rgba(20,184,166,0.9)'
                              : 'none',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

// --- Small presentational subcomponent for the copy task rows ---------------

interface RowProps {
  label: string
  tokens: Token[]
  selected: boolean[]
  mode: 'input' | 'lti' | 'mamba'
}

function Row({ label, tokens, selected, mode }: RowProps) {
  const baseLabelColor =
    mode === 'mamba'
      ? MATH_COLORS.secondary
      : mode === 'lti'
      ? '#9ca3af'
      : '#e5e7eb'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '0.75rem',
        marginTop: '0.25rem',
      }}
    >
      <div
        style={{
          width: '100px',
          fontSize: '0.75rem',
          color: baseLabelColor,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          gap: '0.35rem',
          flexWrap: 'wrap',
        }}
      >
        {tokens.map((token, idx) => {
          const isSelected = selected[idx]
          const isPassword = token.kind === 'password'

          let bg = 'transparent'
          let color = '#6b7280'
          let border = '1px dashed #374151'

          if (mode === 'input') {
            if (isPassword) {
              bg = MATH_COLORS.primary
              color = '#111827'
              border = '1px solid #fbbf24'
            } else if (token.kind === 'marker') {
              bg = '#111827'
              color = '#9ca3af'
              border = '1px solid #4b5563'
            } else {
              bg = '#020617'
              color = '#6b7280'
              border = '1px solid #1f2937'
            }
          } else {
            if (isSelected && mode === 'mamba') {
              bg = MATH_COLORS.secondary
              color = '#0f172a'
              border = '1px solid #5eead4'
            } else if (isSelected && mode === 'lti') {
              bg = '#1f2937'
              color = '#e5e7eb'
              border = '1px solid #9ca3af'
            } else {
              // not selected → blank slot
              bg = '#020617'
              color = '#4b5563'
              border = '1px dashed #1f2937'
            }
          }

          const content =
            mode === 'input'
              ? token.text
              : isSelected && token.kind === 'password'
              ? token.text
              : isSelected && mode === 'lti'
              ? token.text // possibly spurious extra copies
              : '·'

          return (
            <div
              key={`${label}-${idx}`}
              style={{
                minWidth: '28px',
                padding: '0.15rem 0.45rem',
                borderRadius: '999px',
                backgroundColor: bg,
                color,
                border,
                fontSize: '0.8rem',
                textAlign: 'center',
              }}
            >
              {content}
            </div>
          )
        })}
      </div>
    </div>
  )
}
