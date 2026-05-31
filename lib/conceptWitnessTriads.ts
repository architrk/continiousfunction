import { conceptObjectSpanLabel, type ConceptObjectSpan } from './conceptObjectSpans'
import type { DiscussionAnchorListItem } from './discussionAnchors'

export type WitnessTriadSymbolMap = {
  symbol: string
  meaning: string
  codeName: string
  demoControl?: string
  demoOutput?: string
  heldFixedDefault?: boolean
}

export type ResolvedWitnessTriad = {
  id: string
  conceptId: string
  title: string
  invariant: string
  predictionPrompt: string
  defaultChangedSymbol: string
  objectAnchorId?: string
  objectKey?: string
  math: {
    label: string
    href: string
    latex: string
  }
  code: {
    label: string
    href: string
    line: string
  }
  demo: {
    label: string
    href: string
    output: string
  }
  symbols: WitnessTriadSymbolMap[]
  observationCopy: {
    changedVariable: string
    heldFixed: string[]
    observed: string
    nextRepair: string
  }
}

export type WitnessTriadObservation = {
  triadId: string
  conceptId: string
  objectAnchorId?: string
  objectKey?: string
  prediction: string
  changedVariable: string
  heldFixed: string[]
  observed: string
  invariant: string
  nextRepair: string
}

type BuildWitnessTriadsArgs = {
  conceptId: string
  objectSpans: ConceptObjectSpan[]
  discussionItems: DiscussionAnchorListItem[]
  codeHtml: string
  hasVisualization: boolean
}

function hrefFragment(href: string | undefined) {
  if (!href) return null
  const index = href.indexOf('#')
  if (index < 0) return null
  return href.slice(index + 1).trim() || null
}

function findItemForFragment(items: DiscussionAnchorListItem[], fragment: string | undefined) {
  if (!fragment) return undefined
  return items.find((item) => hrefFragment(item.anchor.href) === fragment)
}

function decodeHtmlText(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function codeLineFromHtml(codeHtml: string) {
  const text = decodeHtmlText(
    codeHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(pre|code|span|div|p)>/gi, '\n')
      .replace(/<[^>]*>/g, '')
  )

  return (
    text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => /^elems\s*=/.test(line)) ??
    'elems = B * L * T * Hkv * d_head * 2'
  )
}

const kvMemorySymbols: WitnessTriadSymbolMap[] = [
  {
    symbol: 'B',
    meaning: 'batch size',
    codeName: 'B',
    demoControl: 'Batch',
    heldFixedDefault: true,
  },
  {
    symbol: 'L',
    meaning: 'number of transformer layers',
    codeName: 'L',
    demoControl: 'Layers',
    heldFixedDefault: true,
  },
  {
    symbol: 'T',
    meaning: 'context length in tokens',
    codeName: 'T',
    demoControl: 'Context length',
    demoOutput: 'KV memory',
  },
  {
    symbol: 'H_kv',
    meaning: 'key/value heads after GQA or MQA sharing',
    codeName: 'Hkv',
    demoControl: 'KV heads',
    heldFixedDefault: true,
  },
  {
    symbol: 'd_head',
    meaning: 'width of each head',
    codeName: 'd_head',
    demoControl: 'Head dimension',
    heldFixedDefault: true,
  },
  {
    symbol: '2',
    meaning: 'store both keys and values',
    codeName: '* 2',
    demoOutput: 'K and V tensors',
    heldFixedDefault: true,
  },
  {
    symbol: 'bytes',
    meaning: 'bytes per cached element',
    codeName: 'bytes_per_elem',
    demoControl: 'Precision bytes',
    heldFixedDefault: true,
  },
]

export function buildWitnessTriadsForConcept({
  conceptId,
  objectSpans,
  discussionItems,
  codeHtml,
  hasVisualization,
}: BuildWitnessTriadsArgs): ResolvedWitnessTriad[] {
  if (conceptId !== 'long-context') return []

  const kvMathSpan =
    objectSpans.find((span) => span.kind === 'equation' && /Mem|KV|H_\{?kv\}?|H_\{kv\}/i.test(span.latex ?? span.snippet)) ??
    objectSpans.find((span) => span.kind === 'equation' && span.domId === 'math-object-3') ??
    objectSpans.find((span) => span.kind === 'equation')
  const codeSpan = objectSpans.find((span) => span.kind === 'code-witness')
  const mathItem = findItemForFragment(discussionItems, kvMathSpan?.domId)
  const codeItem = findItemForFragment(discussionItems, codeSpan?.domId)
  const demoItem = discussionItems.find((item) => item.anchor.objectType === 'visualization')

  return [
    {
      id: 'long-context-kv-memory',
      conceptId,
      title: 'KV memory is the same object in the equation, code, and demo.',
      invariant:
        'The cache stores keys and values for every layer, token, KV head, and head dimension. With batch, layers, KV heads, head size, and bytes fixed, memory grows linearly with context length T.',
      predictionPrompt:
        'If T doubles while B, L, H_kv, d_head, and bytes stay fixed, what should happen to KV memory?',
      defaultChangedSymbol: 'T',
      objectAnchorId: mathItem?.anchor.id,
      objectKey: mathItem?.anchor.objectKey,
      math: {
        label: kvMathSpan ? conceptObjectSpanLabel(kvMathSpan) : 'KV memory equation',
        href: mathItem?.anchor.href ?? (kvMathSpan ? `#${kvMathSpan.domId}` : '#math'),
        latex:
          kvMathSpan?.latex ??
          String.raw`\mathrm{Mem}_{KV} \approx B\cdot L\cdot T\cdot H_{kv}\cdot d_{head}\cdot 2 \cdot \mathrm{bytes}`,
      },
      code: {
        label: codeSpan ? conceptObjectSpanLabel(codeSpan) : 'Code witness',
        href: codeItem?.anchor.href ?? (codeSpan ? `#${codeSpan.domId}` : '#code'),
        line: codeLineFromHtml(codeHtml),
      },
      demo: {
        label: hasVisualization ? 'KV Cache demo' : 'Demo planned',
        href: demoItem?.anchor.href ?? '#interactive-demo',
        output: 'KV memory estimate updates when context length, layers, heads, width, batch, or precision changes.',
      },
      symbols: kvMemorySymbols,
      observationCopy: {
        changedVariable: 'T doubled',
        heldFixed: ['B', 'L', 'H_kv', 'd_head', 'bytes'],
        observed:
          'KV memory doubled because context length multiplies the same cached key/value tensor footprint.',
        nextRepair:
          'Reduce H_kv, bytes, or cached tokens instead of treating long context as only an attention-compute problem.',
      },
    },
  ]
}
