import { useEffect, useMemo, useRef, useState } from 'react'
import { emitDemoState } from '../../lib/demoState'

// Gamification types
type GamePhase = 'setup' | 'predicting' | 'revealed'
type TokenCountPrediction = 'low' | 'medium' | 'high' | null

type TokenizationVizProps = {
  conceptId?: string
}

// Mystery challenges for the prediction game
const TOKEN_CHALLENGES = [
  {
    name: '🎲 Mystery Emoji',
    text: '🚀🔥✨🧠💡🎯🌟⚡',
    answer: 'high' as const,
    description: 'Emoji: more or fewer tokens than you expect?',
  },
  {
    name: '🎲 ASCII Art',
    text: '╔══════╗\n║ HELLO ║\n╚══════╝',
    answer: 'high' as const,
    description: 'Box-drawing characters: rare in training data...',
  },
  {
    name: '🎲 Python Code',
    text: 'def factorial(n):\n    return 1 if n <= 1 else n * factorial(n-1)',
    answer: 'medium' as const,
    description: 'Common code patterns: how well does BPE compress?',
  },
  {
    name: '🎲 Long Number',
    text: '123456789012345678901234567890',
    answer: 'high' as const,
    description: 'Long digit sequences: each digit often = 1 token!',
  },
  {
    name: '🎲 Arabic Text',
    text: 'السلام عليكم، كيف حالك؟ أتمنى لك يوماً سعيداً.',
    answer: 'high' as const,
    description: 'Non-Latin scripts: more bytes per character...',
  },
];

// Feedback based on prediction accuracy
const getTokenCountFeedback = (
  predicted: TokenCountPrediction,
  actual: string,
  tokenCount: number,
  charCount: number,
  textType: string
): string => {
  const ratio = charCount > 0 ? tokenCount / charCount : 0;
  const correct = predicted === actual;

  if (correct) {
    if (actual === 'high') {
      return `🎯 Correct! ${tokenCount} tokens for ${charCount} chars (${ratio.toFixed(2)} tokens/char). ${textType === 'emoji' || textType === 'arabic' ? 'Non-ASCII expands in UTF-8, and rare sequences have poor BPE compression!' : 'Each element tokenizes separately with little merging.'}`;
    }
    if (actual === 'medium') {
      return `🎯 Correct! ${tokenCount} tokens for ${charCount} chars (${ratio.toFixed(2)} tokens/char). Common patterns like code keywords and punctuation merge reasonably well.`;
    }
    return `🎯 Correct! Only ${tokenCount} tokens for ${charCount} chars (${ratio.toFixed(2)} tokens/char). Very efficient—BPE learned these common patterns during training!`;
  }

  // Wrong prediction
  if (actual === 'high') {
    return `❌ It's ${tokenCount} tokens (high)! ${charCount} chars → ${ratio.toFixed(2)} tokens/char. ${textType === 'emoji' || textType === 'arabic' ? 'Multi-byte UTF-8 + rare sequences = poor compression.' : 'These patterns are rare in training data, so BPE created few merges for them.'}`;
  }
  if (actual === 'medium') {
    return `❌ It's ${tokenCount} tokens (medium). Not as extreme as you thought! Common code/text patterns get reasonable compression from BPE.`;
  }
  return `❌ It's only ${tokenCount} tokens (low)! Very efficient—BPE has many pre-learned merges for this type of text.`;
};

type TokenizerMode = 'bpe' | 'unigram' | 'byte'
type NormalizationMode = 'none' | 'NFC' | 'NFKC'

type VizToken = {
  raw: string
  display: string
  id: number
  meta?: string
}

type BpeMerge = { a: string; b: string; merged: string; count: number }
type BpeStep = {
  tokens: string[]
  vocab: Map<string, number>
  merge?: BpeMerge
}

type SuspiciousChar = {
  ch: string
  codePoint: number
  hex: string
  label: string
}

const EXAMPLES: Array<{
  id: string
  label: string
  description: string
  text: string
}> = [
  {
    id: 'json',
    label: 'JSON',
    description: 'Punctuation + quotes + numbers + escapes (common “structured output” pain point).',
    text: `{
  "user": "alice",
  "active": true,
  "roles": ["admin", "dev"],
  "quota": 12345678901234567890,
  "path": "C:\\\\Users\\\\alice\\\\projects\\\\demo",
  "note": "café"
}`
  },
  {
    id: 'code',
    label: 'Code',
    description: 'Identifiers, underscores, indentation, and symbols (where token boundaries matter).',
    text: `export function tokenize(input: string) {
  // whitespace + punctuation are real tokens
  const re = /\\s+/g
  return input.trim().split(re)
}

// Example: const total = 1_000_000 + 42
// Example: snake_case + camelCase + kebab-case
`
  },
  {
    id: 'multilingual',
    label: 'Multilingual',
    description: 'Mixed scripts + emoji (byte-level expands; subword tokenizers vary a lot).',
    text: `English العربية 中文 हिंदी русский 日本語 한국어
café naïve coöperate — 🤖✨🔥
混合输入 / mixed-input / إدخال-مختلط`
  },
  {
    id: 'numbers',
    label: 'Long numbers',
    description: 'Long digit runs often tokenize surprisingly (IDs, hashes, scientific notation).',
    text: `Order ID: 00000000000012345678901234567890
Hash: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
Pi: 3.14159265358979323846264338327950288419716939937510
Scientific: 6.022e23`
  },
  {
    id: 'unicode',
    label: 'Invisible Unicode',
    description: 'Normalization + invisible characters: looks the same, tokenizes differently.',
    text:
      // precomposed “café”
      `Visible: café
Decomposed: cafe\u0301
Zero‑width space: hello\u200Bworld
NBSP: 1\u00A0000\u00A0000
Narrow NBSP: 1\u202F000\u202F000
Soft hyphen: re\u00ADenter
`
  }
]

const INVISIBLES: Array<{ codePoint: number; label: string }> = [
  { codePoint: 0x200b, label: 'ZERO WIDTH SPACE (U+200B)' },
  { codePoint: 0x200c, label: 'ZERO WIDTH NON-JOINER (U+200C)' },
  { codePoint: 0x200d, label: 'ZERO WIDTH JOINER (U+200D)' },
  { codePoint: 0xfeff, label: 'BOM / ZERO WIDTH NO-BREAK SPACE (U+FEFF)' },
  { codePoint: 0x00a0, label: 'NO-BREAK SPACE (U+00A0)' },
  { codePoint: 0x202f, label: 'NARROW NO-BREAK SPACE (U+202F)' },
  { codePoint: 0x2060, label: 'WORD JOINER (U+2060)' },
  { codePoint: 0x00ad, label: 'SOFT HYPHEN (U+00AD)' }
]

const DEFAULT_TEXT = EXAMPLES[0]?.text ?? ''
const MAX_RENDER_TOKENS = 4200

// Educational insight based on current tokenization state
const getTokenizationInsight = (
  mode: TokenizerMode,
  tokenCount: number,
  charCount: number,
  byteCount: number,
  vocabSize: number,
  bpeStep?: number,
  suspicious?: SuspiciousChar[]
): string => {
  const tokensPerChar = charCount > 0 ? (tokenCount / charCount).toFixed(2) : '0';

  if (suspicious && suspicious.length > 0) {
    return `⚠️ Unicode gotcha detected! ${suspicious.length} invisible character${suspicious.length > 1 ? 's' : ''} found. These can cause "looks the same, costs different" bugs and security issues.`;
  }

  if (mode === 'bpe') {
    if (bpeStep === 0) {
      return '📝 Step 0: Starting with individual characters. Each unique character is a token. Watch how BPE merges frequent pairs!';
    }
    if (bpeStep && bpeStep > 0 && bpeStep <= 5) {
      return '🔄 Early merges: BPE is combining the most frequent adjacent pairs (like spaces after words, common letter pairs). Compression is starting!';
    }
    if (bpeStep && bpeStep > 20) {
      return '📦 Deep into merges: BPE has learned common subwords and patterns. Notice how token count dropped while vocab size grew.';
    }
    return `💡 BPE tradeoff: ${vocabSize} vocab entries now encode ${charCount} chars as ${tokenCount} tokens. Larger vocab = fewer tokens but bigger embedding matrix.`;
  }

  if (mode === 'unigram') {
    return `🎯 Unigram uses Viterbi to find the most probable segmentation. It picked ${tokenCount} tokens from a vocab of ${vocabSize} to encode ${charCount} chars.`;
  }

  if (mode === 'byte') {
    const expansion = byteCount / charCount;
    if (expansion > 2) {
      return `🌍 High byte expansion (${expansion.toFixed(1)}× chars)! Non-ASCII text (emoji, CJK, Arabic) uses multiple UTF-8 bytes per character.`;
    }
    if (expansion > 1.2) {
      return '📊 Moderate UTF-8 expansion. Some non-ASCII characters are present, using 2-4 bytes each.';
    }
    return '✨ Mostly ASCII! Each character maps to exactly one UTF-8 byte. The simplest case for tokenization.';
  }

  return `📊 ${tokensPerChar} tokens per character. Lower is better for context length and cost!`;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function tokenColorStyle(i: number) {
  const hue = (i * 47) % 360
  return {
    backgroundColor: `hsla(${hue}, 80%, 65%, 0.22)`,
    borderColor: `hsla(${hue}, 80%, 65%, 0.35)`
  } as React.CSSProperties
}

function isPrintableAscii(b: number) {
  return b >= 0x20 && b <= 0x7e
}

function formatHexByte(b: number) {
  return b.toString(16).toUpperCase().padStart(2, '0')
}

function makeVisibleForDisplay(s: string, showInvisibles: boolean) {
  if (!showInvisibles) return s
  return (
    s
      .replace(/\r/g, '␍')
      .replace(/\t/g, '⇥')
      .replace(/\n/g, '↵\n')
      .replace(/ /g, '·')
      .replace(/\u00A0/g, '⍽') // NBSP
      .replace(/\u202F/g, '⍽') // narrow NBSP
      .replace(/\u200B/g, '⟂')
      .replace(/\u200C/g, '⟂')
      .replace(/\u200D/g, '⟂')
      .replace(/\uFEFF/g, '⟂')
      .replace(/\u2060/g, '⟂')
      .replace(/\u00AD/g, '¬')
  )
}

function computeToyBpeSteps(text: string, maxMerges: number): BpeStep[] {
  const baseTokens = Array.from(text)
  const vocab = new Map<string, number>()
  for (const t of baseTokens) {
    if (!vocab.has(t)) vocab.set(t, vocab.size)
  }

  const steps: BpeStep[] = [{ tokens: baseTokens, vocab: new Map(vocab) }]
  let tokens = baseTokens
  const delim = '\u0000'

  for (let k = 0; k < maxMerges; k++) {
    if (tokens.length < 2) break

    const pairCounts = new Map<string, number>()
    for (let i = 0; i < tokens.length - 1; i++) {
      const key = tokens[i] + delim + tokens[i + 1]
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
    }

    let bestKey: string | null = null
    let bestCount = 0
    for (const [key, count] of pairCounts.entries()) {
      if (count > bestCount) {
        bestCount = count
        bestKey = key
      }
    }

    if (!bestKey || bestCount < 2) break

    const splitAt = bestKey.indexOf(delim)
    const a = bestKey.slice(0, splitAt)
    const b = bestKey.slice(splitAt + 1)
    const merged = a + b

    const next: string[] = []
    for (let i = 0; i < tokens.length; ) {
      if (i < tokens.length - 1 && tokens[i] === a && tokens[i + 1] === b) {
        next.push(merged)
        i += 2
      } else {
        next.push(tokens[i])
        i += 1
      }
    }

    tokens = next
    if (!vocab.has(merged)) vocab.set(merged, vocab.size)

    steps.push({
      tokens,
      vocab: new Map(vocab),
      merge: { a, b, merged, count: bestCount }
    })
  }

  return steps
}

function topPairs(tokens: string[], k: number) {
  const delim = '\u0000'
  const pairCounts = new Map<string, number>()
  for (let i = 0; i < tokens.length - 1; i++) {
    const key = tokens[i] + delim + tokens[i + 1]
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
  }

  const pairs = Array.from(pairCounts.entries())
    .map(([key, count]) => {
      const splitAt = key.indexOf(delim)
      const a = key.slice(0, splitAt)
      const b = key.slice(splitAt + 1)
      return { a, b, merged: a + b, count }
    })
    .sort((x, y) => y.count - x.count)

  return pairs.slice(0, k)
}

function computeToyUnigram(
  text: string,
  opts: { maxTokenLength: number; maxVocab: number; lengthBias: number }
): { tokens: string[]; tokenToId: Map<string, number>; tokenToCost: Map<string, number>; vocabSize: number } {
  const chars = Array.from(text)
  const n = chars.length
  if (n === 0) {
    return { tokens: [], tokenToId: new Map(), tokenToCost: new Map(), vocabSize: 0 }
  }

  const { maxTokenLength, maxVocab, lengthBias } = opts

  const counts = new Map<string, number>()
  for (let i = 0; i < n; i++) {
    let s = ''
    for (let len = 1; len <= maxTokenLength && i + len <= n; len++) {
      s += chars[i + len - 1]
      counts.set(s, (counts.get(s) ?? 0) + 1)
    }
  }

  const singleChars = Array.from(new Set(chars))

  const multi = Array.from(counts.entries())
    .filter(([tok, c]) => tok.length >= 2 && c >= 2)
    .map(([tok, c]) => {
      const len = Array.from(tok).length
      const score = c * Math.pow(len, lengthBias)
      return { tok, c, len, score }
    })
    .sort((a, b) => b.score - a.score)

  const budgetForMulti = Math.max(0, maxVocab - singleChars.length)
  const chosenMulti = multi.slice(0, budgetForMulti)

  const vocab: Array<{ tok: string; count: number; len: number; mass: number }> = []

  for (const ch of singleChars) {
    const c = counts.get(ch) ?? 1
    const len = 1
    const mass = c * Math.pow(len, lengthBias)
    vocab.push({ tok: ch, count: c, len, mass })
  }

  for (const m of chosenMulti) {
    vocab.push({ tok: m.tok, count: m.c, len: m.len, mass: m.c * Math.pow(m.len, lengthBias) })
  }

  const totalMass = vocab.reduce((acc, v) => acc + v.mass, 0) || 1
  const tokenToCost = new Map<string, number>()
  for (const v of vocab) {
    const p = v.mass / totalMass
    tokenToCost.set(v.tok, -Math.log(Math.max(1e-12, p)))
  }

  const sortedByProb = [...vocab]
    .sort((a, b) => {
      const ca = tokenToCost.get(a.tok) ?? 0
      const cb = tokenToCost.get(b.tok) ?? 0
      if (ca !== cb) return ca - cb
      return b.len - a.len
    })
    .map(v => v.tok)

  const tokenToId = new Map<string, number>()
  for (const tok of sortedByProb) {
    if (!tokenToId.has(tok)) tokenToId.set(tok, tokenToId.size)
  }

  const dp: number[] = new Array(n + 1).fill(Number.POSITIVE_INFINITY)
  const back: Array<{ len: number; tok: string } | null> = new Array(n + 1).fill(null)
  dp[n] = 0

  for (let i = n - 1; i >= 0; i--) {
    let s = ''
    for (let len = 1; len <= maxTokenLength && i + len <= n; len++) {
      s += chars[i + len - 1]
      const costTok = tokenToCost.get(s)
      if (costTok === undefined) continue
      const candidate = costTok + dp[i + len]
      if (candidate < dp[i]) {
        dp[i] = candidate
        back[i] = { len, tok: s }
      }
    }
  }

  const out: string[] = []
  for (let i = 0; i < n; ) {
    const choice = back[i]
    if (!choice) {
      out.push(chars[i])
      i += 1
      continue
    }
    out.push(choice.tok)
    i += choice.len
  }

  return { tokens: out, tokenToId, tokenToCost, vocabSize: tokenToId.size }
}

function computeByteTokens(
  text: string,
  encoder: TextEncoder,
  showInvisibles: boolean
): { tokens: VizToken[]; byteCount: number } {
  const chars = Array.from(text)
  const out: VizToken[] = []

  let byteCount = 0
  for (const ch of chars) {
    const bytes = Array.from(encoder.encode(ch))
    byteCount += bytes.length
    for (const b of bytes) {
      let display = ''
      if (b === 0x0a) display = showInvisibles ? '↵' : '\n'
      else if (b === 0x09) display = showInvisibles ? '⇥' : '\t'
      else if (b === 0x0d) display = showInvisibles ? '␍' : '\r'
      else if (b === 0x20) display = showInvisibles ? '·' : ' '
      else if (isPrintableAscii(b)) display = String.fromCharCode(b)
      else display = `\\x${formatHexByte(b)}`

      out.push({
        raw: `0x${formatHexByte(b)}`,
        display,
        id: b,
        meta: `byte ${b} (0x${formatHexByte(b)})`
      })
    }
  }

  return { tokens: out, byteCount }
}

function findSuspicious(text: string): SuspiciousChar[] {
  const hits: SuspiciousChar[] = []
  const byCodePoint = new Map<number, string>()
  for (const item of INVISIBLES) byCodePoint.set(item.codePoint, item.label)

  for (const ch of Array.from(text)) {
    const cp = ch.codePointAt(0) ?? 0
    const label = byCodePoint.get(cp)
    if (label) {
      hits.push({
        ch,
        codePoint: cp,
        hex: `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`,
        label
      })
    }
  }

  if (/\p{M}/u.test(text)) {
    hits.push({
      ch: '◌',
      codePoint: -1,
      hex: '—',
      label: 'Combining marks present (Unicode category \\p{M})'
    })
  }

  return hits
}

function formatDollars(x: number) {
  if (!Number.isFinite(x)) return '$0.00'
  if (x < 0.0001) return `$${x.toExponential(2)}`
  return `$${x.toFixed(4)}`
}

function TokenStrip(props: {
  tokens: VizToken[]
  showIds: boolean
  showInvisibles: boolean
  renderLimit?: number
}) {
  const { tokens, showIds, showInvisibles, renderLimit = MAX_RENDER_TOKENS } = props

  const clipped = tokens.length > renderLimit
  const shown = clipped ? tokens.slice(0, renderLimit) : tokens

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">Token view</div>
        <div className="panel-meta">
          {tokens.length.toLocaleString()} tokens{clipped ? ` (showing first ${renderLimit.toLocaleString()})` : ''}
        </div>
      </div>

      <div className="token-strip">
        {shown.map((t, i) => {
          const display = makeVisibleForDisplay(t.display, showInvisibles)
          return (
            <span
              key={`${i}-${t.id}-${t.raw}`}
              className="token"
              style={tokenColorStyle(i)}
              title={t.meta ?? t.raw}
            >
              <span className="token-text">{display}</span>
              {showIds ? <span className="token-id">#{t.id}</span> : null}
            </span>
          )
        })}
      </div>

      {clipped ? (
        <div className="hint">
          Rendering thousands of spans can be slow. Tip: reduce input size or lower merge count.
        </div>
      ) : null}
    </div>
  )
}

function BpeTradeoffChart(props: {
  steps: Array<{ tokenCount: number; vocabSize: number }>
  current: number
}) {
  const { steps, current } = props
  const w = 360
  const h = 120
  const pad = 10
  const n = steps.length
  if (n <= 1) return null

  const tokenCounts = steps.map(s => s.tokenCount)
  const vocabSizes = steps.map(s => s.vocabSize)
  const minTok = Math.min(...tokenCounts)
  const maxTok = Math.max(...tokenCounts)
  const minV = Math.min(...vocabSizes)
  const maxV = Math.max(...vocabSizes)

  const x = (i: number) => pad + (i / (n - 1)) * (w - 2 * pad)
  const yTok = (v: number) => {
    if (maxTok === minTok) return h / 2
    return pad + ((maxTok - v) / (maxTok - minTok)) * (h - 2 * pad)
  }
  const yV = (v: number) => {
    if (maxV === minV) return h / 2
    return pad + ((maxV - v) / (maxV - minV)) * (h - 2 * pad)
  }

  const pathTok = tokenCounts
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${yTok(v).toFixed(2)}`)
    .join(' ')
  const pathV = vocabSizes
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${yV(v).toFixed(2)}`)
    .join(' ')

  const cx = x(clamp(current, 0, n - 1))

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">BPE tradeoff</div>
        <div className="panel-meta">step {current}/{n - 1}</div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="chart" role="img" aria-label="BPE tradeoff chart showing tokens vs vocabulary size during tokenizer training">
        <path d={pathTok} fill="none" stroke="rgba(96,165,250,0.9)" strokeWidth={2} />
        <path d={pathV} fill="none" stroke="rgba(52,211,153,0.9)" strokeWidth={2} />
        <line x1={cx} x2={cx} y1={pad} y2={h - pad} stroke="rgba(148,163,184,0.35)" strokeWidth={1} />
      </svg>
      <div className="legend">
        <div><span className="swatch swatch-blue" /> tokens (↓)</div>
        <div><span className="swatch swatch-green" /> vocab size (↑)</div>
      </div>
    </div>
  )
}

export default function TokenizationViz({ conceptId = 'tokenization-vocabulary' }: TokenizationVizProps) {
  const [exampleId, setExampleId] = useState<string>(EXAMPLES[0]?.id ?? 'json')
  const [rawText, setRawText] = useState<string>(DEFAULT_TEXT)

  const [mode, setMode] = useState<TokenizerMode>('bpe')
  const [normalization, setNormalization] = useState<NormalizationMode>('none')
  const [showInvisibles, setShowInvisibles] = useState<boolean>(true)
  const [showTokenIds, setShowTokenIds] = useState<boolean>(true)
  const [pricePer1k, setPricePer1k] = useState<number>(0.01)

  // BPE controls
  const [maxBpeMerges, setMaxBpeMerges] = useState<number>(30)
  const [bpeStep, setBpeStep] = useState<number>(0)
  const [playing, setPlaying] = useState<boolean>(false)

  // Unigram controls
  const [uniMaxLen, setUniMaxLen] = useState<number>(8)
  const [uniVocab, setUniVocab] = useState<number>(260)
  const [uniLengthBias, setUniLengthBias] = useState<number>(1.2)

  // Game state
  const [gameMode, setGameMode] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [selectedChallenge, setSelectedChallenge] = useState<typeof TOKEN_CHALLENGES[0] | null>(null)
  const [prediction, setPrediction] = useState<TokenCountPrediction>(null)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [challengeTokenCount, setChallengeTokenCount] = useState(0)
  const [challengeCharCount, setChallengeCharCount] = useState(0)

  const encoder = useMemo(() => new TextEncoder(), [])

  const normalizedText = useMemo(() => {
    try {
      if (normalization === 'NFC') return rawText.normalize('NFC')
      if (normalization === 'NFKC') return rawText.normalize('NFKC')
      return rawText
    } catch {
      return rawText
    }
  }, [rawText, normalization])

  const normalizationChanged = useMemo(() => normalizedText !== rawText, [normalizedText, rawText])

  const suspicious = useMemo(() => findSuspicious(normalizedText), [normalizedText])
  const charCount = useMemo(() => Array.from(normalizedText).length, [normalizedText])
  const utf8ByteCount = useMemo(() => encoder.encode(normalizedText).length, [encoder, normalizedText])

  const bpeSteps = useMemo(() => {
    if (mode !== 'bpe') return []
    return computeToyBpeSteps(normalizedText, clamp(maxBpeMerges, 0, 80))
  }, [mode, normalizedText, maxBpeMerges])

  useEffect(() => {
    if (mode !== 'bpe') return
    setPlaying(false)
    setBpeStep(0)
  }, [mode, normalizedText, maxBpeMerges])

  useEffect(() => {
    if (mode !== 'bpe') return
    setBpeStep((s) => clamp(s, 0, Math.max(0, bpeSteps.length - 1)))
  }, [mode, bpeSteps.length])

  const intervalRef = useRef<number | null>(null)
  useEffect(() => {
    if (mode !== 'bpe') return
    if (!playing) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = window.setInterval(() => {
      setBpeStep((s) => {
        const last = Math.max(0, bpeSteps.length - 1)
        if (s >= last) return 0
        return s + 1
      })
    }, 650)

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [playing, mode, bpeSteps.length])

  const unigram = useMemo(() => {
    if (mode !== 'unigram') {
      return { tokens: [] as string[], tokenToId: new Map<string, number>(), tokenToCost: new Map<string, number>(), vocabSize: 0 }
    }
    return computeToyUnigram(normalizedText, {
      maxTokenLength: clamp(uniMaxLen, 2, 16),
      maxVocab: clamp(uniVocab, 50, 800),
      lengthBias: clamp(uniLengthBias, 0.5, 2.0)
    })
  }, [mode, normalizedText, uniMaxLen, uniVocab, uniLengthBias])

  const byteViz = useMemo(() => {
    if (mode !== 'byte') return { tokens: [] as VizToken[], byteCount: 0 }
    return computeByteTokens(normalizedText, encoder, showInvisibles)
  }, [mode, normalizedText, encoder, showInvisibles])

  const bpeViz = useMemo(() => {
    if (mode !== 'bpe') return { tokens: [] as VizToken[], vocabSize: 0, merge: undefined as BpeMerge | undefined, stepCount: 0, steps: [] as Array<{ tokenCount: number; vocabSize: number }> }
    const step = bpeSteps[clamp(bpeStep, 0, Math.max(0, bpeSteps.length - 1))]
    const vocabSize = step?.vocab.size ?? 0
    const tokens = (step?.tokens ?? []).map((t) => ({
      raw: t,
      display: t,
      id: step?.vocab.get(t) ?? -1,
      meta: step?.merge ? `merged via: ${step.merge.a}+${step.merge.b}→${step.merge.merged}` : 'base symbol'
    }))
    const steps = bpeSteps.map(s => ({ tokenCount: s.tokens.length, vocabSize: s.vocab.size }))
    return { tokens, vocabSize, merge: step?.merge, stepCount: bpeSteps.length, steps }
  }, [mode, bpeSteps, bpeStep])

  const unigramTokens = useMemo(() => {
    if (mode !== 'unigram') return [] as VizToken[]
    return unigram.tokens.map((t) => ({
      raw: t,
      display: t,
      id: unigram.tokenToId.get(t) ?? -1,
      meta: (() => {
        const c = unigram.tokenToCost.get(t)
        if (c === undefined) return t
        return `-log p(token) ≈ ${c.toFixed(3)}`
      })()
    }))
  }, [mode, unigram.tokens, unigram.tokenToId, unigram.tokenToCost])

  const activeTokens = useMemo(() => {
    if (mode === 'bpe') return bpeViz.tokens
    if (mode === 'unigram') return unigramTokens
    return byteViz.tokens
  }, [mode, bpeViz.tokens, unigramTokens, byteViz.tokens])

  const tokenCount = activeTokens.length
  const vocabSize =
    mode === 'bpe' ? bpeViz.vocabSize :
      mode === 'unigram' ? unigram.vocabSize :
        256

  const estimatedCost = (tokenCount / 1000) * (Number.isFinite(pricePer1k) ? pricePer1k : 0)

  // Dynamic educational insight
  const currentInsight = useMemo(() => {
    return getTokenizationInsight(
      mode,
      tokenCount,
      charCount,
      utf8ByteCount,
      vocabSize,
      mode === 'bpe' ? bpeStep : undefined,
      suspicious.length > 0 ? suspicious : undefined
    );
  }, [mode, tokenCount, charCount, utf8ByteCount, vocabSize, bpeStep, suspicious]);

  const compareCounts = useMemo(() => {
    const bpe = computeToyBpeSteps(normalizedText, clamp(maxBpeMerges, 0, 80))
    const bpeLast = bpe[bpe.length - 1]
    const bpeCount = bpeLast?.tokens.length ?? 0

    const uni = computeToyUnigram(normalizedText, {
      maxTokenLength: clamp(uniMaxLen, 2, 16),
      maxVocab: clamp(uniVocab, 50, 800),
      lengthBias: clamp(uniLengthBias, 0.5, 2.0)
    })
    const uniCount = uni.tokens.length

    const bytes = encoder.encode(normalizedText).length

    return { bpeCount, uniCount, byteCount: bytes }
  }, [normalizedText, maxBpeMerges, uniMaxLen, uniVocab, uniLengthBias, encoder])

  // Game control functions
  const startChallenge = (challenge: typeof TOKEN_CHALLENGES[0]) => {
    setSelectedChallenge(challenge);
    setPrediction(null);
    setGamePhase('predicting');
  };

  const submitPrediction = (pred: TokenCountPrediction) => {
    if (!selectedChallenge || !pred) return;
    setPrediction(pred);

    // Calculate actual token count for this challenge
    const bpeStepsForChallenge = computeToyBpeSteps(selectedChallenge.text, 30);
    const lastStep = bpeStepsForChallenge[bpeStepsForChallenge.length - 1];
    const tokens = lastStep?.tokens.length ?? 0;
    const chars = Array.from(selectedChallenge.text).length;

    setChallengeTokenCount(tokens);
    setChallengeCharCount(chars);

    // Update score
    const correct = pred === selectedChallenge.answer;
    setScore(prev => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    }));

    setGamePhase('revealed');
  };

  const resetGame = () => {
    setGamePhase('setup');
    setSelectedChallenge(null);
    setPrediction(null);
  };

  const currentExample = useMemo(
    () => EXAMPLES.find(e => e.id === exampleId) ?? EXAMPLES[0],
    [exampleId]
  )

  const bpeTopPairs = useMemo(() => {
    if (mode !== 'bpe') return []
    const step = bpeSteps[clamp(bpeStep, 0, Math.max(0, bpeSteps.length - 1))]
    if (!step) return []
    return topPairs(step.tokens, 8)
  }, [mode, bpeSteps, bpeStep])

  const tokensPerChar = charCount > 0 ? tokenCount / charCount : 0
  const bytesPerChar = charCount > 0 ? utf8ByteCount / charCount : 0

  useEffect(() => {
    const modeDetail =
      mode === 'bpe'
        ? `BPE step ${bpeStep}/${Math.max(0, bpeViz.stepCount - 1)}${bpeViz.merge ? `, merge ${bpeViz.merge.a}+${bpeViz.merge.b}->${bpeViz.merge.merged}` : ', base symbols'}`
        : mode === 'unigram'
          ? `unigram max token length ${uniMaxLen}, vocab cap ${uniVocab}, length bias ${uniLengthBias.toFixed(2)}`
          : `byte-level UTF-8 expansion ${bytesPerChar.toFixed(2)} bytes/char`

    emitDemoState({
      conceptId,
      label: 'Tokenization cost and segmentation state',
      summary: `${mode.toUpperCase()} encodes ${charCount} chars/${utf8ByteCount} UTF-8 bytes as ${tokenCount} tokens (vocab ${vocabSize}, ${tokensPerChar.toFixed(2)} tokens/char). Comparison counts: BPE ${compareCounts.bpeCount}, unigram ${compareCounts.uniCount}, byte ${compareCounts.byteCount}.`,
      values: [
        `example: ${currentExample?.label ?? 'custom text'}`,
        `mode: ${mode}, normalization: ${normalization}${normalizationChanged ? ' (changed text)' : ''}`,
        `characters: ${charCount}, UTF-8 bytes: ${utf8ByteCount}, bytes/char: ${bytesPerChar.toFixed(2)}`,
        `active tokens: ${tokenCount}, vocab size: ${vocabSize}, tokens/char: ${tokensPerChar.toFixed(2)}`,
        `estimated cost: $${estimatedCost.toFixed(5)}`,
        modeDetail,
        suspicious.length > 0
          ? `unicode warnings: ${suspicious.map((item) => item.hex).slice(0, 4).join(', ')}`
          : 'unicode warnings: none',
        gameMode
          ? `challenge phase: ${gamePhase}${selectedChallenge ? `, ${selectedChallenge.name}` : ''}${prediction ? `, prediction ${prediction}` : ''}`
          : 'challenge phase: setup',
      ],
    })
  }, [
    bpeStep,
    bpeViz.merge,
    bpeViz.stepCount,
    bytesPerChar,
    charCount,
    compareCounts.bpeCount,
    compareCounts.byteCount,
    compareCounts.uniCount,
    conceptId,
    currentExample?.label,
    estimatedCost,
    gameMode,
    gamePhase,
    mode,
    normalization,
    normalizationChanged,
    prediction,
    selectedChallenge,
    suspicious,
    tokenCount,
    tokensPerChar,
    uniLengthBias,
    uniMaxLen,
    uniVocab,
    utf8ByteCount,
    vocabSize,
  ])

  return (
    <section className="card interactive-card tokenization-viz">
      <h2>Tokenization Microscope</h2>
      <p className="muted">
        Tokenization turns text into token IDs. This toy lab shows (1) BPE merges compressing frequent patterns,
        (2) unigram segmentation picking the most likely path, and (3) byte-level expansion for Unicode.
      </p>

      {/* Game Mode Toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem', marginBottom: gameMode ? 0 : '0.75rem' }}>
        <button
          onClick={() => {
            setGameMode(!gameMode);
            if (!gameMode) resetGame();
          }}
          style={{
            fontSize: '0.8rem',
            padding: '0.4rem 0.9rem',
            borderRadius: '999px',
            border: gameMode ? '1px solid #f59e0b' : '1px solid rgba(245, 158, 11, 0.3)',
            background: gameMode
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.1))'
              : 'rgba(8, 12, 20, 0.9)',
            color: gameMode ? '#fbbf24' : '#e5e7eb',
            cursor: 'pointer',
            fontWeight: gameMode ? 600 : 400,
          }}
        >
          {gameMode ? '🎮 Challenge Mode' : '🎮 Try Challenge'}
        </button>
        {gameMode && score.total > 0 && (
          <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
            Score: {score.correct}/{score.total}
          </span>
        )}
      </div>

      {/* Game Panel */}
      {gameMode && (
        <div style={{
          marginTop: '0.75rem',
          marginBottom: '0.75rem',
          padding: '0.9rem',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(251, 191, 36, 0.08))',
          border: '1px solid rgba(245, 158, 11, 0.35)',
        }}>
          {gamePhase === 'setup' && (
            <>
              <p style={{ fontSize: '0.88rem', color: '#fbbf24', marginBottom: '0.5rem', fontWeight: 600 }}>
                🎯 Token Count Challenge
              </p>
              <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '0.65rem' }}>
                How many tokens will this mystery text produce? Predict: Low (efficient), Medium, or High (expensive)
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {TOKEN_CHALLENGES.map((challenge) => (
                  <button
                    key={challenge.name}
                    onClick={() => startChallenge(challenge)}
                    title={challenge.description}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.45rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      background: 'rgba(0, 0, 0, 0.3)',
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

          {gamePhase === 'predicting' && selectedChallenge && (
            <>
              <p style={{ fontSize: '0.88rem', color: '#fbbf24', marginBottom: '0.4rem', fontWeight: 600 }}>
                {selectedChallenge.name}
              </p>
              <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                {selectedChallenge.description}
              </p>
              <div style={{
                padding: '0.6rem',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.25)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: '#e5e7eb',
                marginBottom: '0.65rem',
                whiteSpace: 'pre-wrap',
                maxHeight: '80px',
                overflow: 'auto',
              }}>
                {selectedChallenge.text}
              </div>
              <p style={{ fontSize: '0.78rem', color: '#e5e7eb', marginBottom: '0.5rem' }}>
                How many tokens will BPE produce for this?
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => submitPrediction('low')}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid #22c55e',
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: '#22c55e',
                    cursor: 'pointer',
                  }}
                >
                  🟢 Low (efficient)
                </button>
                <button
                  onClick={() => submitPrediction('medium')}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid #f59e0b',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                    cursor: 'pointer',
                  }}
                >
                  🟡 Medium
                </button>
                <button
                  onClick={() => submitPrediction('high')}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid #ef4444',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    cursor: 'pointer',
                  }}
                >
                  🔴 High (expensive)
                </button>
              </div>
            </>
          )}

          {gamePhase === 'revealed' && selectedChallenge && (
            <>
              <div style={{
                padding: '0.7rem',
                borderRadius: '10px',
                background: prediction === selectedChallenge.answer
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
                border: prediction === selectedChallenge.answer
                  ? '1px solid rgba(34, 197, 94, 0.35)'
                  : '1px solid rgba(239, 68, 68, 0.35)',
                marginBottom: '0.7rem',
              }}>
                <p style={{ fontSize: '0.82rem', color: '#e5e7eb', lineHeight: 1.55 }}>
                  {getTokenCountFeedback(
                    prediction,
                    selectedChallenge.answer,
                    challengeTokenCount,
                    challengeCharCount,
                    selectedChallenge.name.includes('Emoji') ? 'emoji' : selectedChallenge.name.includes('Arabic') ? 'arabic' : 'other'
                  )}
                </p>
              </div>
              <button
                onClick={resetGame}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.45rem 0.9rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  background: 'rgba(0, 0, 0, 0.3)',
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

      <div className="layout">
        <div className="col">
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Curated examples</div>
              <div className="panel-meta">{currentExample?.description}</div>
            </div>
            <div className="example-buttons">
              {EXAMPLES.map(ex => (
                <button
                  key={ex.id}
                  className={['example-btn', ex.id === exampleId ? 'active' : ''].join(' ')}
                  onClick={() => {
                    setExampleId(ex.id)
                    setRawText(ex.text)
                    setPlaying(false)
                    setBpeStep(0)
                  }}
                  type="button"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Input text</div>
              <div className="panel-meta">{Array.from(rawText).length.toLocaleString()} chars</div>
            </div>
            <textarea
              value={rawText}
              onChange={e => {
                setRawText(e.target.value)
                setPlaying(false)
              }}
              spellCheck={false}
            />
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Controls</div>
              <div className="panel-meta">mode, normalization, and the cost lens</div>
            </div>

            <div className="controls-grid">
              <label className="field">
                <span className="label">Tokenizer mode</span>
                <select value={mode} onChange={e => setMode(e.target.value as TokenizerMode)}>
                  <option value="bpe">Toy BPE (merges)</option>
                  <option value="unigram">Toy unigram (Viterbi)</option>
                  <option value="byte">Byte-level (UTF-8)</option>
                </select>
              </label>

              <label className="field">
                <span className="label">Normalization</span>
                <select value={normalization} onChange={e => setNormalization(e.target.value as NormalizationMode)}>
                  <option value="none">None</option>
                  <option value="NFC">NFC</option>
                  <option value="NFKC">NFKC</option>
                </select>
                {normalization !== 'none' ? (
                  <span className={['subtle', normalizationChanged ? 'warn' : ''].join(' ')}>
                    {normalizationChanged ? 'Changed by normalization.' : `Unchanged under ${normalization}.`}
                  </span>
                ) : null}
              </label>

              <label className="field">
                <span className="label">Cost per 1k tokens ($)</span>
                <input
                  type="number"
                  min={0}
                  step={0.001}
                  value={Number.isFinite(pricePer1k) ? pricePer1k : 0}
                  onChange={e => setPricePer1k(Number(e.target.value))}
                />
                <span className="subtle">Used only for the estimate.</span>
              </label>

              <div className="field">
                <span className="label">Display</span>
                <div className="toggles">
                  <label className="toggle">
                    <input type="checkbox" checked={showInvisibles} onChange={e => setShowInvisibles(e.target.checked)} />
                    <span>Show invisibles</span>
                  </label>
                  <label className="toggle">
                    <input type="checkbox" checked={showTokenIds} onChange={e => setShowTokenIds(e.target.checked)} />
                    <span>Show token IDs</span>
                  </label>
                </div>
              </div>
            </div>

            {mode === 'bpe' ? (
              <div className="mode-panel">
                <div className="mode-title">Toy BPE controls</div>

                <label className="slider">
                  <span>Max merges: {maxBpeMerges}</span>
                  <input
                    type="range"
                    min={0}
                    max={80}
                    step={1}
                    value={maxBpeMerges}
                    onChange={e => setMaxBpeMerges(Number(e.target.value))}
                  />
                </label>

                <div className="bpe-step-row">
                  <label className="slider bpe-step">
                    <span>Step: {bpeStep}/{Math.max(0, bpeSteps.length - 1)}</span>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, bpeSteps.length - 1)}
                      step={1}
                      value={clamp(bpeStep, 0, Math.max(0, bpeSteps.length - 1))}
                      onChange={e => setBpeStep(Number(e.target.value))}
                      disabled={bpeSteps.length <= 1}
                    />
                  </label>
                  <button
                    type="button"
                    className="small-btn"
                    onClick={() => setPlaying(p => !p)}
                    disabled={bpeSteps.length <= 1}
                  >
                    {playing ? 'Pause' : 'Play'}
                  </button>
                </div>

                {bpeViz.merge ? (
                  <div className="merge-note">
                    Latest merge: <span className="mono">{bpeViz.merge.a}</span> + <span className="mono">{bpeViz.merge.b}</span> →{' '}
                    <span className="mono">{bpeViz.merge.merged}</span> (count {bpeViz.merge.count})
                  </div>
                ) : (
                  <div className="merge-note">Step 0 is the base alphabet (code points) for this input.</div>
                )}

                {bpeTopPairs.length ? (
                  <div className="pairs">
                    <div className="pairs-title">Most frequent adjacent pairs (current step)</div>
                    <ol>
                      {bpeTopPairs.map((p, idx) => (
                        <li key={`${p.a}-${p.b}-${idx}`}>
                          <span className="mono">{p.a}</span> + <span className="mono">{p.b}</span> → <span className="mono">{p.merged}</span>
                          <span className="pairs-count">× {p.count}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </div>
            ) : null}

            {mode === 'unigram' ? (
              <div className="mode-panel">
                <div className="mode-title">Toy unigram controls</div>
                <label className="slider">
                  <span>Max token length: {uniMaxLen}</span>
                  <input type="range" min={2} max={16} step={1} value={uniMaxLen} onChange={e => setUniMaxLen(Number(e.target.value))} />
                </label>
                <label className="slider">
                  <span>Vocab size (cap): {uniVocab}</span>
                  <input type="range" min={50} max={800} step={10} value={uniVocab} onChange={e => setUniVocab(Number(e.target.value))} />
                </label>
                <label className="slider">
                  <span>Length bias: {uniLengthBias.toFixed(2)}</span>
                  <input type="range" min={0.5} max={2.0} step={0.05} value={uniLengthBias} onChange={e => setUniLengthBias(Number(e.target.value))} />
                </label>
                <div className="merge-note">
                  This toy unigram builds a small substring vocab from your input and runs Viterbi segmentation.
                </div>
              </div>
            ) : null}

            {mode === 'byte' ? (
              <div className="mode-panel">
                <div className="mode-title">Byte-level note</div>
                <div className="merge-note">
                  Byte-level shows UTF-8 bytes as tokens (0–255). Emoji and many scripts expand into multiple bytes.
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="col">
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Metrics</div>
              <div className="panel-meta">compute/cost is in tokens</div>
            </div>

            <div className="metrics">
              <div className="metric">
                <div className="metric-label">Tokens</div>
                <div className="metric-value">{tokenCount.toLocaleString()}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Chars</div>
                <div className="metric-value">{charCount.toLocaleString()}</div>
              </div>
              <div className="metric">
                <div className="metric-label">UTF-8 bytes</div>
                <div className="metric-value">{utf8ByteCount.toLocaleString()}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Toy vocab size</div>
                <div className="metric-value">{vocabSize.toLocaleString()}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Estimated cost</div>
                <div className="metric-value">{formatDollars(estimatedCost)}</div>
                <div className="metric-sub">${pricePer1k}/1k tokens</div>
              </div>
            </div>

            {/* Dynamic educational insight */}
            <div
              className="insight-box"
              style={{
                marginTop: '0.9rem',
                padding: '0.85rem',
                borderRadius: '10px',
                background: suspicious.length > 0
                  ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.08))'
                  : mode === 'bpe' && bpeStep > 10
                    ? 'linear-gradient(135deg, rgba(52, 211, 153, 0.15), rgba(34, 197, 94, 0.08))'
                    : 'linear-gradient(135deg, rgba(96, 165, 250, 0.15), rgba(59, 130, 246, 0.08))',
                border: suspicious.length > 0
                  ? '1px solid rgba(251, 191, 36, 0.3)'
                  : mode === 'bpe' && bpeStep > 10
                    ? '1px solid rgba(52, 211, 153, 0.3)'
                    : '1px solid rgba(96, 165, 250, 0.3)',
              }}
            >
              <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.6 }}>
                {currentInsight}
              </div>
            </div>

            <div className="compare">
              <div className="compare-title">Quick compare (same text)</div>
              <div className="compare-grid">
                <div className="compare-card">
                  <div className="compare-label">Toy BPE</div>
                  <div className="compare-value">{compareCounts.bpeCount.toLocaleString()} tokens</div>
                </div>
                <div className="compare-card">
                  <div className="compare-label">Toy unigram</div>
                  <div className="compare-value">{compareCounts.uniCount.toLocaleString()} tokens</div>
                </div>
                <div className="compare-card">
                  <div className="compare-label">Byte-level</div>
                  <div className="compare-value">{compareCounts.byteCount.toLocaleString()} bytes</div>
                </div>
              </div>
              <div className="compare-note">
                Aha: context length and cost are about <span className="mono">tokens</span>. Tokenization decides how much text fits.
              </div>
            </div>
          </div>

          {mode === 'bpe' && bpeViz.steps.length > 1 ? (
            <BpeTradeoffChart steps={bpeViz.steps} current={clamp(bpeStep, 0, Math.max(0, bpeViz.steps.length - 1))} />
          ) : null}

          {suspicious.length ? (
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Unicode gotchas</div>
                <div className="panel-meta">visually similar ≠ same bytes/tokens</div>
              </div>
              <ul className="suspicious">
                {suspicious.map((h, idx) => (
                  <li key={`${h.codePoint}-${idx}`}>
                    <span className="mono">{h.hex}</span> — {h.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <TokenStrip tokens={activeTokens} showIds={showTokenIds} showInvisibles={showInvisibles} />

          {normalization !== 'none' && normalizationChanged ? (
            <div className="panel warn-panel">
              <div className="panel-header">
                <div className="panel-title">Normalization changed the text</div>
                <div className="panel-meta">try “Invisible Unicode”</div>
              </div>
              <div className="warn-note">
                Visually similar strings can have different code points (and bytes) → different tokens. This matters for reliability, cost, and security.
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <style jsx>{`
        .tokenization-viz {
          display: block;
        }

        .layout {
          display: grid;
          grid-template-columns: 1fr 1.1fr;
          gap: 1rem;
          margin-top: 1rem;
        }

        .col {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          min-width: 0;
        }

        .panel {
          background: rgba(8, 12, 20, 0.45);
          border: 1px solid rgba(245, 158, 11, 0.18);
          border-radius: 12px;
          padding: 0.9rem;
        }

        .panel-header {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          margin-bottom: 0.75rem;
        }

        .panel-title {
          color: rgba(255, 255, 255, 0.92);
          font-weight: 600;
        }

        .panel-meta {
          color: var(--text-secondary);
          font-size: 0.85rem;
          line-height: 1.4;
        }

        textarea {
          width: 100%;
          min-height: 160px;
          resize: vertical;
          border-radius: 10px;
          border: 1px solid rgba(245, 158, 11, 0.2);
          background: rgba(0, 0, 0, 0.28);
          padding: 0.75rem;
          color: rgba(255, 255, 255, 0.92);
          font-family: var(--font-mono);
          line-height: 1.5;
          outline: none;
        }

        textarea:focus {
          border-color: rgba(245, 158, 11, 0.45);
        }

        select,
        input[type='number'] {
          width: 100%;
          border-radius: 10px;
          border: 1px solid rgba(245, 158, 11, 0.2);
          background: rgba(0, 0, 0, 0.28);
          padding: 0.5rem 0.6rem;
          color: rgba(255, 255, 255, 0.92);
          outline: none;
        }

        select:focus,
        input[type='number']:focus {
          border-color: rgba(245, 158, 11, 0.45);
        }

        .example-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }

        .example-btn {
          border-radius: 10px;
          border: 1px solid rgba(245, 158, 11, 0.18);
          background: rgba(0, 0, 0, 0.22);
          color: rgba(255, 255, 255, 0.85);
          padding: 0.35rem 0.55rem;
          font-size: 0.8rem;
          cursor: pointer;
        }

        .example-btn:hover {
          border-color: rgba(245, 158, 11, 0.35);
          background: rgba(245, 158, 11, 0.08);
        }

        .example-btn.active {
          border-color: rgba(245, 158, 11, 0.55);
          background: rgba(245, 158, 11, 0.12);
        }

        .controls-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.8rem;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .label {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .subtle {
          font-size: 0.75rem;
          color: var(--text-tertiary);
        }

        .subtle.warn {
          color: rgba(251, 191, 36, 0.9);
        }

        .toggles {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          margin-top: 0.15rem;
        }

        .toggle {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.85);
        }

        .mode-panel {
          margin-top: 0.9rem;
          border-top: 1px solid rgba(245, 158, 11, 0.12);
          padding-top: 0.9rem;
        }

        .mode-title {
          font-size: 0.9rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.92);
          margin-bottom: 0.6rem;
        }

        .slider {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          margin-bottom: 0.7rem;
          color: rgba(255, 255, 255, 0.85);
          font-size: 0.85rem;
        }

        input[type='range'] {
          width: 100%;
        }

        .bpe-step-row {
          display: flex;
          align-items: flex-end;
          gap: 0.75rem;
        }

        .bpe-step {
          flex: 1;
        }

        .small-btn {
          border-radius: 10px;
          border: 1px solid rgba(245, 158, 11, 0.25);
          background: rgba(245, 158, 11, 0.12);
          color: rgba(255, 255, 255, 0.9);
          padding: 0.5rem 0.75rem;
          cursor: pointer;
          height: 38px;
        }

        .small-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .merge-note {
          font-size: 0.8rem;
          color: var(--text-secondary);
          line-height: 1.5;
          margin-top: 0.4rem;
        }

        .pairs {
          margin-top: 0.8rem;
        }

        .pairs-title {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-bottom: 0.4rem;
        }

        .pairs ol {
          margin: 0;
          padding-left: 1.25rem;
          color: rgba(255, 255, 255, 0.85);
          font-family: var(--font-mono);
          font-size: 0.8rem;
          line-height: 1.6;
        }

        .pairs-count {
          margin-left: 0.5rem;
          color: rgba(245, 158, 11, 0.85);
          font-family: var(--font-mono);
        }

        .metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.6rem;
        }

        .metric {
          border: 1px solid rgba(245, 158, 11, 0.12);
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.2);
          padding: 0.6rem;
        }

        .metric-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .metric-value {
          font-size: 1.1rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.92);
          margin-top: 0.25rem;
          font-family: var(--font-mono);
        }

        .metric-sub {
          font-size: 0.72rem;
          color: var(--text-tertiary);
          margin-top: 0.2rem;
        }

        .compare {
          margin-top: 0.9rem;
          border-top: 1px solid rgba(245, 158, 11, 0.12);
          padding-top: 0.9rem;
        }

        .compare-title {
          font-size: 0.9rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.92);
        }

        .compare-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.6rem;
          margin-top: 0.6rem;
        }

        .compare-card {
          border: 1px solid rgba(245, 158, 11, 0.12);
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.2);
          padding: 0.6rem;
        }

        .compare-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .compare-value {
          font-size: 0.9rem;
          color: rgba(255, 255, 255, 0.9);
          margin-top: 0.3rem;
          font-family: var(--font-mono);
        }

        .compare-note {
          margin-top: 0.6rem;
          color: var(--text-secondary);
          font-size: 0.8rem;
          line-height: 1.5;
        }

        .mono {
          font-family: var(--font-mono);
        }

        .suspicious {
          margin: 0;
          padding-left: 1.15rem;
          color: rgba(255, 255, 255, 0.85);
          font-size: 0.85rem;
          line-height: 1.6;
        }

        .token-strip {
          font-family: var(--font-mono);
          font-size: 0.95rem;
          line-height: 1.6;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .token {
          display: inline-block;
          border-radius: 8px;
          border: 1px solid;
          padding: 0.12rem 0.3rem;
          margin-right: 0.2rem;
          margin-bottom: 0.2rem;
        }

        .token-id {
          margin-left: 0.35rem;
          font-size: 0.72rem;
          opacity: 0.7;
          vertical-align: top;
        }

        .hint {
          margin-top: 0.6rem;
          font-size: 0.8rem;
          color: rgba(251, 191, 36, 0.95);
        }

        .chart {
          width: 100%;
          height: 120px;
          display: block;
          margin-top: 0.5rem;
        }

        .legend {
          display: flex;
          gap: 1rem;
          margin-top: 0.4rem;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .swatch {
          width: 10px;
          height: 10px;
          border-radius: 3px;
          display: inline-block;
          margin-right: 0.35rem;
          vertical-align: middle;
        }

        .swatch-blue {
          background: rgba(96, 165, 250, 0.9);
        }

        .swatch-green {
          background: rgba(52, 211, 153, 0.9);
        }

        .warn-panel {
          border-color: rgba(251, 191, 36, 0.25);
          background: rgba(251, 191, 36, 0.06);
        }

        .warn-note {
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.88);
          line-height: 1.55;
        }

        @media (max-width: 1100px) {
          .layout {
            grid-template-columns: 1fr;
          }

          .controls-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  )
}
