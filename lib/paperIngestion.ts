export const PAPER_MAPPER_CONTRACT_VERSION = 'continuous-function.paper-mapper.v1'

export type PaperSourceKind = 'empty' | 'arxiv' | 'pdf' | 'abstract' | 'title'

export type PaperPdfUpload = {
  fileName: string
  mimeType: string
  size: number
  base64: string
}

export type PaperSourceSpan = {
  id: string
  label: string
  quote: string
  page?: number
  lineStart: number
  lineEnd: number
}

export type PaperEquationSpan = {
  id: string
  equation: string
  sourceId: string
  page?: number
  lineStart: number
  lineEnd: number
}

export type PaperEquationObject = {
  id: string
  label: string
  equation: string
  confidence: 'high' | 'medium'
  source: {
    kind: 'pdf' | 'pasted-text' | 'metadata'
    sourceId: string
    page?: number
    lineStart?: number
    lineEnd?: number
    bbox?: {
      x: number
      y: number
      width: number
      height: number
    }
  }
  prompt: string
  graphAttachment: {
    type: 'equation'
    conceptIds: string[]
    paper: string
    route: string[]
  }
}

export type PaperIngestionPreview = {
  kind: PaperSourceKind
  arxivId?: string
  canonicalUrl?: string
  pdfUrl?: string
  pdfFileName?: string
  pdfBytes?: number
  inputChars: number
  matchedTerms: string[]
  equationCandidates: string[]
  sourceSpans: PaperSourceSpan[]
  equationSpans: PaperEquationSpan[]
  equationObjects: PaperEquationObject[]
  steps: Array<{ label: string; status: 'ready' | 'needs live lookup' | 'pending'; detail: string }>
}

const ARXIV_NEW_ID = /(?:arxiv:\s*)?(\d{4}\.\d{4,5})(v\d+)?/i
const ARXIV_OLD_ID = /(?:arxiv:\s*)?([a-z-]+(?:\.[A-Z]{2})?\/\d{7})(v\d+)?/i

function cleanArxivId(id: string) {
  return id.trim().replace(/^arxiv:\s*/i, '').replace(/\.pdf$/i, '')
}

export function parseArxivId(input: string) {
  const text = input.trim()
  if (!text) return undefined

  const urlMatch = text.match(/arxiv\.org\/(?:abs|pdf|html)\/([^?\s#)]+)/i)
  if (urlMatch?.[1]) {
    return cleanArxivId(urlMatch[1])
  }

  const newId = text.match(ARXIV_NEW_ID)
  if (newId?.[1]) {
    return `${newId[1]}${newId[2] ?? ''}`
  }

  const oldId = text.match(ARXIV_OLD_ID)
  if (oldId?.[1]) {
    return `${oldId[1]}${oldId[2] ?? ''}`
  }

  return undefined
}

export function detectPaperSourceKind(input: string): PaperSourceKind {
  const text = input.trim()
  if (!text) return 'empty'
  if (isPdfReference(text)) return 'pdf'
  if (parseArxivId(text)) return 'arxiv'
  if (text.length > 420 || /\babstract\b/i.test(text)) return 'abstract'
  return 'title'
}

function isPdfReference(input: string) {
  const text = input.trim()
  return (
    /\.pdf(?:$|[?#\s])/i.test(text) ||
    /arxiv\.org\/pdf\//i.test(text) ||
    text.toLowerCase().includes('application/pdf')
  )
}

function resolvePdfUrl(input: string, arxivId?: string) {
  const text = input.trim()
  if (/^https?:\/\/\S+\.pdf(?:$|[?#\s])/i.test(text)) return text.split(/\s+/)[0]
  if (/^https?:\/\/arxiv\.org\/pdf\//i.test(text) && arxivId) return `https://arxiv.org/pdf/${arxivId}`
  return undefined
}

function linePageMarker(line: string) {
  const match = line.match(/(?:^|\[|\b)(?:page|p\.)\s*(\d{1,4})(?:\]|\b|:)?/i)
  return match?.[1] ? Number(match[1]) : undefined
}

function compactLine(line: string) {
  return line.replace(/\s+/g, ' ').trim()
}

function looksEquationLike(line: string) {
  const compact = compactLine(line)
  const hasMathStructure =
    /=|\\frac|\\sum|\\mathbb|softmax|KL|log\s|theta|pi\(|p_\w|h_t|x_t|QK|->|→|\^|_|\*/i.test(compact)
  const hasNamedMath =
    /\b(?:loss|objective|gradient|update)\b/i.test(compact) && /[=()_+\-*/^]|\\/.test(compact)

  return (
    compact.length <= 180 &&
    (hasMathStructure || hasNamedMath)
  )
}

export function extractSourceSpans(input: string): PaperSourceSpan[] {
  const lines = input.split(/\n/)
  const spans: PaperSourceSpan[] = []
  let currentPage: number | undefined

  lines.forEach((line, index) => {
    const page = linePageMarker(line)
    if (page) currentPage = page

    const quote = compactLine(line.replace(/^\s*(?:\[?page\s*\d+\]?|p\.\s*\d+)\s*:?\s*/i, ''))
    if (!quote || quote.length < 32) return
    if (/^https?:\/\//i.test(quote)) return
    if (looksEquationLike(quote)) return

    spans.push({
      id: `span-${index + 1}`,
      label: currentPage ? `Page ${currentPage}, line ${index + 1}` : `Line ${index + 1}`,
      quote: quote.slice(0, 220),
      page: currentPage,
      lineStart: index + 1,
      lineEnd: index + 1,
    })
  })

  return spans.slice(0, 6)
}

export function extractEquationSpans(input: string): PaperEquationSpan[] {
  const lines = input.split(/\n/)
  const spans: PaperEquationSpan[] = []
  let currentPage: number | undefined

  lines.forEach((line, index) => {
    const page = linePageMarker(line)
    if (page) currentPage = page

    const equation = compactLine(line.replace(/^\s*(?:\[?page\s*\d+\]?|p\.\s*\d+)\s*:?\s*/i, ''))
    if (!equation || !looksEquationLike(equation)) return

    spans.push({
      id: `eq-${index + 1}`,
      equation,
      sourceId: currentPage ? `page-${currentPage}` : 'pasted-source',
      page: currentPage,
      lineStart: index + 1,
      lineEnd: index + 1,
    })
  })

  const seen = new Set<string>()
  return spans.filter((span) => {
    const key = span.equation.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 8)
}

export function extractEquationCandidates(input: string) {
  const spanCandidates = extractEquationSpans(input).map((span) => span.equation)
  if (spanCandidates.length) return spanCandidates.slice(0, 6)

  const lines = input
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)

  const candidates = lines.filter((line) => {
    const compact = line.replace(/\s+/g, ' ')
    return (
      compact.length <= 180 &&
      (/=|\\frac|\\sum|\\mathbb|softmax|KL|log\s|theta|pi\(|p_\w|h_t|x_t|QK/i.test(compact) ||
        /\b(?:loss|objective|gradient|attention|update)\b/i.test(compact))
    )
  })

  return Array.from(new Set(candidates)).slice(0, 6)
}

function stableObjectId(value: string, index: number) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42)

  return `eqobj-${slug || 'equation'}-${index + 1}`
}

function equationLabel(span: Pick<PaperEquationSpan, 'page' | 'lineStart' | 'lineEnd'>) {
  const lineLabel =
    span.lineEnd && span.lineEnd !== span.lineStart
      ? `lines ${span.lineStart}-${span.lineEnd}`
      : `line ${span.lineStart}`

  return span.page ? `Page ${span.page}, ${lineLabel}` : `Source ${lineLabel}`
}

function equationPrompt(equation: string, route: string[]) {
  const routeText = route.length ? ` Connect it to this concept route: ${route.join(' -> ')}.` : ''
  return `Explain this equation from the paper step by step. Define every symbol, name the tensor or scalar shapes when possible, say what assumption the equation depends on, and point to the smallest prerequisite repair.${routeText}\n\nEquation: ${equation}`
}

function buildEquationObjectsFromSpans(
  spans: PaperEquationSpan[],
  context: {
    conceptIds?: string[]
    paper?: string
    route?: string[]
    sourceKind?: PaperEquationObject['source']['kind']
  } = {}
): PaperEquationObject[] {
  const route = context.route?.filter(Boolean).slice(0, 8) ?? []
  const conceptIds = context.conceptIds?.filter(Boolean).slice(0, 8) ?? []
  const paper = context.paper?.trim() || 'Pasted paper excerpt'
  const sourceKind = context.sourceKind ?? 'pasted-text'

  return spans.slice(0, 8).map((span, index) => ({
    id: stableObjectId(span.equation, index),
    label: equationLabel(span),
    equation: span.equation,
    confidence: span.page ? 'high' : 'medium',
    source: {
      kind: sourceKind,
      sourceId: span.sourceId,
      page: span.page,
      lineStart: span.lineStart,
      lineEnd: span.lineEnd,
    },
    prompt: equationPrompt(span.equation, route),
    graphAttachment: {
      type: 'equation',
      conceptIds,
      paper,
      route,
    },
  }))
}

export function buildLocalEquationObjects(
  input: string,
  matchedTerms: string[] = [],
  context: {
    conceptIds?: string[]
    paper?: string
    route?: string[]
    sourceKind?: PaperEquationObject['source']['kind']
  } = {}
) {
  const fallbackRoute = matchedTerms.slice(0, 6)
  return buildEquationObjectsFromSpans(extractEquationSpans(input), {
    conceptIds: context.conceptIds ?? fallbackRoute,
    paper: context.paper,
    route: context.route ?? fallbackRoute,
    sourceKind: context.sourceKind,
  })
}

export function buildPaperIngestionPreview(
  input: string,
  matchedTerms: string[] = [],
  pdfUpload?: PaperPdfUpload | null
): PaperIngestionPreview {
  const text = input.trim()
  const kind = pdfUpload ? 'pdf' : detectPaperSourceKind(text)
  const arxivId = parseArxivId(text)
  const canonicalUrl = arxivId ? `https://arxiv.org/abs/${arxivId}` : undefined
  const pdfUrl = pdfUpload ? undefined : resolvePdfUrl(text, arxivId)
  const sourceSpans = extractSourceSpans(text)
  const equationSpans = extractEquationSpans(text)
  const equationCandidates = equationSpans.map((span) => span.equation).slice(0, 6)
  const equationObjects = buildEquationObjectsFromSpans(equationSpans, {
    conceptIds: matchedTerms,
    route: matchedTerms,
    paper: pdfUpload?.fileName ?? canonicalUrl ?? text.slice(0, 90),
    sourceKind: kind === 'pdf' ? 'pdf' : 'pasted-text',
  })
  const hasPdfBytes = Boolean(pdfUpload?.base64)
  const hasPdfUrl = Boolean(pdfUrl)
  const needsPdfParser = kind === 'pdf' && !equationCandidates.length

  return {
    kind,
    arxivId,
    canonicalUrl,
    pdfUrl,
    pdfFileName: pdfUpload?.fileName,
    pdfBytes: pdfUpload?.size,
    inputChars: text.length,
    matchedTerms,
    equationCandidates,
    sourceSpans,
    equationSpans,
    equationObjects,
    steps: [
      {
        label: 'Classify source',
        status: kind === 'empty' ? 'pending' : 'ready',
        detail: kind === 'empty' ? 'Paste a title, abstract, arXiv URL, or PDF reference.' : `Detected ${kind} input.`,
      },
      {
        label: 'Resolve paper metadata',
        status: arxivId ? 'needs live lookup' : 'pending',
        detail: arxivId
          ? `Live source lookup can fetch arXiv metadata for ${arxivId}.`
          : 'Needs an arXiv ID, DOI, title search, or PDF parser.',
      },
      {
        label: 'Parse PDF bytes',
        status: hasPdfBytes || hasPdfUrl ? 'needs live lookup' : kind === 'pdf' ? 'pending' : 'ready',
        detail: hasPdfBytes
          ? `Live source lookup can parse ${pdfUpload?.fileName ?? 'uploaded PDF'} (${Math.round((pdfUpload?.size ?? 0) / 1024)} KB).`
          : hasPdfUrl
            ? `Live source lookup can fetch and parse ${pdfUrl}.`
            : kind === 'pdf'
              ? 'Needs a PDF URL or uploaded file bytes.'
              : 'No PDF parser needed for pasted text.',
      },
      {
        label: 'Extract equations',
        status: equationCandidates.length ? 'ready' : 'needs live lookup',
        detail: equationCandidates.length
          ? `${equationCandidates.length} equation-like snippet${equationCandidates.length === 1 ? '' : 's'} found with line${equationSpans.some((span) => span.page) ? '/page' : ''} spans.`
          : needsPdfParser
            ? 'Live source lookup should parse PDF text streams and recover page-local math blocks.'
            : 'Live source lookup should parse paper text and math blocks.',
      },
      {
        label: 'Run source-grounded mapper',
        status: 'needs live lookup',
        detail: 'Server-side AI should map only from retrieved metadata, extracted equations, and internal concept snippets.',
      },
    ],
  }
}

export function buildPaperMapperGatewayRequest(
  input: string,
  matchedTerms: string[] = [],
  pdfUpload?: PaperPdfUpload | null
) {
  const arxivId = parseArxivId(input)
  const kind = pdfUpload ? 'pdf' : detectPaperSourceKind(input)

  return {
    version: PAPER_MAPPER_CONTRACT_VERSION,
    source: {
      raw: input.trim(),
      kind,
      arxivId,
      pdfUrl: pdfUpload ? undefined : resolvePdfUrl(input, arxivId),
      pdfBase64: pdfUpload?.base64,
      filename: pdfUpload?.fileName,
      mimeType: pdfUpload?.mimeType,
    },
    hints: {
      matchedTerms,
    },
  }
}
