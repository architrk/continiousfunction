const CONTRACT_VERSION = 'continuous-function.paper-mapper.v1'
const DEFAULT_ALLOWED_ORIGINS = [
  'https://continuousfunction.ai',
  'https://www.continuousfunction.ai',
  'http://localhost:3003',
  'http://127.0.0.1:3003',
  'http://localhost:3005',
  'http://127.0.0.1:3005',
]
const DEFAULT_RATE_LIMIT_PER_MINUTE = 20
const DEFAULT_MAX_SOURCE_CHARS = 24000
const DEFAULT_MAX_PDF_BYTES = 6 * 1024 * 1024
const DEFAULT_MAX_OUTPUT_TOKENS = 900
const DEFAULT_PDF_ALLOWED_HOSTS = ['arxiv.org', 'www.arxiv.org']
const DEFAULT_PDF_FETCH_TIMEOUT_MS = 10000
const DEFAULT_PDF_MAX_REDIRECTS = 2

const buckets = new Map()

class PublicError extends Error {
  constructor(code, status = 400) {
    super(code)
    this.code = code
    this.status = status
  }
}

const conceptLexicon = [
  { id: 'efficient-attention', label: 'Efficient Attention', terms: ['kv', 'cache', 'memory', 'flashattention', 'gqa', 'mqa', 'inference'] },
  { id: 'llm-serving', label: 'LLM Serving', terms: ['serving', 'latency', 'prefill', 'decode', 'throughput'] },
  { id: 'long-context', label: 'Long Context', terms: ['long context', 'context length', '128k', 'million token'] },
  { id: 'rope', label: 'RoPE', terms: ['rope', 'rotary', 'position extrapolation'] },
  { id: 'dpo', label: 'DPO', terms: ['dpo', 'preference', 'log odds'] },
  { id: 'rlhf', label: 'RLHF', terms: ['rlhf', 'human feedback', 'reward model'] },
  { id: 'kl-divergence', label: 'KL Divergence', terms: ['kl', 'reference policy', 'regularization'] },
  { id: 'mamba-ssm', label: 'SSM / Mamba', terms: ['mamba', 'state space', 'ssm', 'selective', 'scan'] },
  { id: 'diffusion', label: 'Diffusion', terms: ['diffusion', 'denoising', 'score'] },
  { id: 'flow-matching', label: 'Flow Matching', terms: ['flow matching', 'velocity field', 'ode'] },
  { id: 'muon', label: 'Muon / Optimizer Geometry', terms: ['muon', 'adamw', 'newton-schulz', 'orthogonal'] },
]

function parseList(value, fallback) {
  if (!value || typeof value !== 'string') return fallback
  const parsed = value.split(',').map((item) => item.trim()).filter(Boolean)
  return parsed.length ? parsed : fallback
}

function parseNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseOptionalNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function corsHeaders(origin) {
  return {
    'access-control-allow-origin': origin || 'null',
    'access-control-allow-methods': 'POST, OPTIONS, GET',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  }
}

function getAllowedOrigin(request, env, options = {}) {
  const origin = request.headers.get('origin') ?? ''
  if (!origin) return options.allowMissingOrigin ? '*' : ''
  const allowedOrigins = parseList(env.ALLOWED_ORIGINS, DEFAULT_ALLOWED_ORIGINS)
  return allowedOrigins.includes(origin) ? origin : ''
}

function jsonResponse(payload, status, origin = '*') {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(origin),
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function clientKey(request, env = {}) {
  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp

  if (env.TRUST_X_FORWARDED_FOR === '1') {
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    if (forwarded) return forwarded
  }

  return 'anonymous'
}

function checkRateLimit(request, env) {
  const limit = parseNumber(env.RATE_LIMIT_PER_MINUTE, DEFAULT_RATE_LIMIT_PER_MINUTE)
  const currentMinute = Math.floor(Date.now() / 60000)
  const key = `${clientKey(request, env)}:${currentMinute}`
  const count = buckets.get(key) ?? 0
  buckets.set(key, count + 1)

  if (buckets.size > 5000) {
    for (const bucketKey of buckets.keys()) {
      if (!bucketKey.endsWith(`:${currentMinute}`)) buckets.delete(bucketKey)
    }
  }

  return count < limit
}

function maxJsonBodyBytes(env) {
  const explicitLimit = parseOptionalNumber(env.MAX_JSON_BODY_BYTES)
  if (explicitLimit) return explicitLimit

  const maxPdfBytes = parseNumber(env.MAX_PDF_BYTES, DEFAULT_MAX_PDF_BYTES)
  return Math.ceil(maxPdfBytes * 4 / 3) + 256 * 1024
}

function byteLength(text) {
  return new TextEncoder().encode(text).length
}

async function readJsonWithLimit(request, env) {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new PublicError('unsupported_content_type', 415)
  }

  const limit = maxJsonBodyBytes(env)
  const declaredLength = request.headers.get('content-length')
  if (declaredLength) {
    const declared = Number(declaredLength)
    if (!Number.isFinite(declared) || declared < 0 || declared > limit) {
      throw new PublicError('request_too_large', 413)
    }
  }

  const text = await request.text()
  if (byteLength(text) > limit) throw new PublicError('request_too_large', 413)

  try {
    return JSON.parse(text)
  } catch {
    throw new PublicError('invalid_json', 400)
  }
}

function toPublicError(error) {
  if (error instanceof PublicError) return error
  return new PublicError('invalid_request', 400)
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function truncate(value, maxLength) {
  return typeof value === 'string' && value.length > maxLength
    ? `${value.slice(0, maxLength).trimEnd()}...`
    : value
}

function byteLengthFromBase64(base64) {
  const clean = String(base64 ?? '').replace(/^data:application\/pdf;base64,/i, '').replace(/\s+/g, '')
  if (!clean) return 0
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0
  return Math.floor((clean.length * 3) / 4) - padding
}

function base64ToBytes(base64) {
  const clean = String(base64 ?? '').replace(/^data:application\/pdf;base64,/i, '').replace(/\s+/g, '')
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function bytesToBinaryString(bytes) {
  const chunkSize = 0x8000
  let text = ''
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    text += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return text
}

function bytesToBase64(bytes) {
  const chunkSize = 0x8000
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function binaryStringToBytes(binary) {
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index) & 0xff
  }
  return bytes
}

function parseArxivId(input) {
  const text = String(input ?? '').trim()
  const urlMatch = text.match(/arxiv\.org\/(?:abs|pdf|html)\/([^?\s#)]+)/i)
  if (urlMatch?.[1]) return urlMatch[1].replace(/\.pdf$/i, '')
  const newId = text.match(/(?:arxiv:\s*)?(\d{4}\.\d{4,5})(v\d+)?/i)
  if (newId?.[1]) return `${newId[1]}${newId[2] ?? ''}`
  const oldId = text.match(/(?:arxiv:\s*)?([a-z-]+(?:\.[A-Z]{2})?\/\d{7})(v\d+)?/i)
  if (oldId?.[1]) return `${oldId[1]}${oldId[2] ?? ''}`
  return undefined
}

function isPdfReference(input) {
  const text = String(input ?? '').trim()
  return (
    /\.pdf(?:$|[?#\s])/i.test(text) ||
    /arxiv\.org\/pdf\//i.test(text) ||
    text.toLowerCase().includes('application/pdf')
  )
}

function resolvePdfUrl(raw, suppliedPdfUrl, arxivId) {
  const supplied = String(suppliedPdfUrl ?? '').trim()
  if (supplied) return supplied

  const text = String(raw ?? '').trim()
  if (/^https?:\/\/\S+\.pdf(?:$|[?#\s])/i.test(text)) return text.split(/\s+/)[0]
  if (/^https?:\/\/arxiv\.org\/pdf\//i.test(text) && arxivId) return `https://arxiv.org/pdf/${arxivId}`
  return undefined
}

function detectKind(raw, suppliedKind) {
  if (['arxiv', 'pdf', 'abstract', 'title'].includes(suppliedKind)) return suppliedKind
  if (!raw.trim()) return 'empty'
  if (isPdfReference(raw)) return 'pdf'
  if (parseArxivId(raw)) return 'arxiv'
  if (raw.length > 420 || /\babstract\b/i.test(raw)) return 'abstract'
  return 'title'
}

function linePageMarker(line) {
  const match = String(line ?? '').match(/(?:^|\[|\b)(?:page|p\.)\s*(\d{1,4})(?:\]|\b|:)?/i)
  return match?.[1] ? Number(match[1]) : undefined
}

function compactLine(line) {
  return String(line ?? '').replace(/\s+/g, ' ').trim()
}

function removePageMarker(line) {
  return String(line ?? '').replace(/^\s*(?:\[?page\s*\d+\]?|p\.\s*\d+)\s*:?\s*/i, '')
}

function looksEquationLike(line) {
  const compact = compactLine(line)
  const hasMathStructure =
    /=|\\frac|\\sum|\\mathbb|softmax|KL|log\s|theta|pi\(|p_\w|h_t|x_t|QK|->|→|\^|_|\*/i.test(compact)
  const hasNamedMath =
    /\b(?:loss|objective|gradient|update)\b/i.test(compact) && /[=()_+\-*/^]|\\/.test(compact)

  return compact.length <= 180 && (hasMathStructure || hasNamedMath)
}

export function extractSourceSpans(input) {
  const lines = String(input ?? '').split(/\n/)
  const spans = []
  let currentPage

  lines.forEach((line, index) => {
    const page = linePageMarker(line)
    if (page) currentPage = page

    const quote = compactLine(removePageMarker(line))
    if (!quote || quote.length < 32) return
    if (/^https?:\/\//i.test(quote)) return
    if (looksEquationLike(quote)) return

    spans.push({
      id: `span-${index + 1}`,
      label: currentPage ? `Page ${currentPage}, line ${index + 1}` : `Line ${index + 1}`,
      quote: truncate(quote, 220),
      page: currentPage,
      lineStart: index + 1,
      lineEnd: index + 1,
    })
  })

  return spans.slice(0, 8)
}

export function extractEquationSpans(input) {
  const lines = String(input ?? '').split(/\n/)
  const spans = []
  let currentPage

  lines.forEach((line, index) => {
    const page = linePageMarker(line)
    if (page) currentPage = page

    const equation = compactLine(removePageMarker(line))
    if (!equation || !looksEquationLike(equation)) return

    spans.push({
      id: `eq-${index + 1}`,
      equation,
      sourceId: currentPage ? `page-${currentPage}` : 'source-text',
      page: currentPage,
      lineStart: index + 1,
      lineEnd: index + 1,
    })
  })

  const seen = new Set()
  return spans
    .filter((span) => {
      const key = span.equation.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 8)
}

function extractMetadataSourceSpans(metadata) {
  if (!metadata) return []
  return [
    metadata.title
      ? {
          id: 'arxiv-title',
          label: 'arXiv title',
          quote: truncate(metadata.title, 220),
          lineStart: 1,
          lineEnd: 1,
        }
      : undefined,
    metadata.abstract
      ? {
          id: 'arxiv-abstract',
          label: 'arXiv abstract',
          quote: truncate(metadata.abstract, 220),
          lineStart: 1,
          lineEnd: 1,
        }
      : undefined,
  ].filter(Boolean)
}

function extractCombinedEquationSpans(raw, metadata) {
  const userSpans = extractEquationSpans(raw)
  const metadataText = [metadata?.title, metadata?.abstract].filter(Boolean).join('\n')
  const metadataSpans = extractEquationSpans(metadataText).map((span) => ({
    ...span,
    id: `metadata-${span.id}`,
    sourceId: 'arxiv-metadata',
  }))

  const seen = new Set()
  return [...userSpans, ...metadataSpans]
    .filter((span) => {
      const key = span.equation.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 8)
}

function extractEquationCandidates(input) {
  return extractEquationSpans(input)
    .map((span) => span.equation)
    .slice(0, 8)
}

function collectPdfObjects(pdfText) {
  return Array.from(pdfText.matchAll(/(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g)).map((match) => ({
    id: Number(match[1]),
    generation: Number(match[2]),
    body: match[3],
  }))
}

function extractContentRefs(pageBody) {
  const match = pageBody.match(/\/Contents\s+(?:\[(.*?)\]|(\d+\s+\d+\s+R))/s)
  if (!match) return []
  const refs = match[1] ?? match[2] ?? ''
  return Array.from(refs.matchAll(/(\d+)\s+\d+\s+R/g)).map((item) => Number(item[1]))
}

function buildContentPageMap(objects) {
  const map = new Map()
  let page = 0

  objects.forEach((object) => {
    if (!/\/Type\s*\/Page(?!s)/.test(object.body)) return
    page += 1
    extractContentRefs(object.body).forEach((ref) => map.set(ref, page))
  })

  return map
}

async function inflatePdfStream(bytes) {
  if (typeof DecompressionStream !== 'function') return undefined
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return undefined
  }
}

async function decodePdfStream(objectBody, warnings) {
  const streamMatch = objectBody.match(/stream\r?\n?([\s\S]*?)\r?\n?endstream/)
  if (!streamMatch) return undefined
  const rawStream = streamMatch[1].replace(/^\r?\n/, '').replace(/\r?\n$/, '')
  const bytes = binaryStringToBytes(rawStream)

  if (/\/FlateDecode\b/.test(objectBody)) {
    const inflated = await inflatePdfStream(bytes)
    if (!inflated) {
      warnings.push('A compressed PDF stream could not be inflated by the Worker runtime.')
      return undefined
    }
    return bytesToBinaryString(inflated)
  }

  return rawStream
}

function decodePdfLiteral(literal) {
  let output = ''
  for (let index = 0; index < literal.length; index += 1) {
    const char = literal[index]
    if (char !== '\\') {
      output += char
      continue
    }

    const next = literal[index + 1]
    if (!next) continue
    if (next === 'n') output += '\n'
    else if (next === 'r') output += '\r'
    else if (next === 't') output += '\t'
    else if (next === 'b') output += '\b'
    else if (next === 'f') output += '\f'
    else if (next === '(' || next === ')' || next === '\\') output += next
    else if (/[0-7]/.test(next)) {
      const octal = literal.slice(index + 1).match(/^[0-7]{1,3}/)?.[0] ?? next
      output += String.fromCharCode(Number.parseInt(octal, 8))
      index += octal.length - 1
    } else {
      output += next
    }
    index += 1
  }
  return output
}

function decodePdfHex(hex) {
  const clean = String(hex ?? '').replace(/\s+/g, '')
  const bytes = []
  for (let index = 0; index < clean.length; index += 2) {
    const pair = clean.slice(index, index + 2)
    if (!/^[0-9a-f]{1,2}$/i.test(pair)) continue
    bytes.push(Number.parseInt(pair.padEnd(2, '0'), 16))
  }

  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let text = ''
    for (let index = 2; index < bytes.length; index += 2) {
      text += String.fromCharCode(((bytes[index] ?? 0) << 8) + (bytes[index + 1] ?? 0))
    }
    return text
  }

  return bytes.map((byte) => String.fromCharCode(byte)).join('')
}

function readPdfLiteralToken(text, start) {
  let depth = 1
  let value = ''
  let cursor = start + 1

  while (cursor < text.length && depth > 0) {
    const char = text[cursor]
    if (char === '\\') {
      value += char
      cursor += 1
      if (cursor < text.length) value += text[cursor]
    } else if (char === '(') {
      depth += 1
      value += char
    } else if (char === ')') {
      depth -= 1
      if (depth > 0) value += char
    } else {
      value += char
    }
    cursor += 1
  }

  return depth === 0
    ? {
        token: { type: 'string', value: decodePdfLiteral(value), raw: value, index: start },
        next: cursor,
      }
    : undefined
}

function readPdfHexToken(text, start) {
  if (text[start + 1] === '<') return undefined
  const end = text.indexOf('>', start + 1)
  if (end === -1) return undefined
  const raw = text.slice(start + 1, end)
  if (!/^[\da-f\s]+$/i.test(raw)) return undefined

  return {
    token: { type: 'string', value: decodePdfHex(raw), raw, index: start, encoding: 'hex' },
    next: end + 1,
  }
}

function tokenizePdfContent(text) {
  const tokens = []
  for (let index = 0; index < text.length;) {
    const char = text[index]

    if (/\s/.test(char)) {
      index += 1
      continue
    }

    if (char === '%') {
      const end = text.indexOf('\n', index)
      index = end === -1 ? text.length : end + 1
      continue
    }

    if (char === '(') {
      const literal = readPdfLiteralToken(text, index)
      if (literal) {
        tokens.push(literal.token)
        index = literal.next
        continue
      }
    }

    if (char === '<') {
      if (text[index + 1] === '<') {
        tokens.push({ type: 'delimiter', value: '<<', index })
        index += 2
        continue
      }
      const hex = readPdfHexToken(text, index)
      if (hex) {
        tokens.push(hex.token)
        index = hex.next
        continue
      }
    }

    if (char === '[' || char === ']' || char === '>' || char === '/') {
      if (char === '/') {
        const match = text.slice(index).match(/^\/[^\s<>\[\]()/%]+/)
        if (match) {
          tokens.push({ type: 'name', value: match[0], index })
          index += match[0].length
          continue
        }
      }
      tokens.push({ type: 'delimiter', value: char, index })
      index += 1
      continue
    }

    const numberMatch = text.slice(index).match(/^[+-]?(?:\d+\.\d+|\d+|\.\d+)/)
    if (numberMatch) {
      tokens.push({ type: 'number', value: Number(numberMatch[0]), raw: numberMatch[0], index })
      index += numberMatch[0].length
      continue
    }

    const wordMatch = text.slice(index).match(/^[^\s<>\[\]()/%]+/)
    if (wordMatch) {
      tokens.push({ type: 'operator', value: wordMatch[0], index })
      index += wordMatch[0].length
      continue
    }

    index += 1
  }

  return tokens
}

function printableRatio(text) {
  if (!text) return 0
  const printable = Array.from(text).filter((char) => /[\t\n\r -~\u00a0-\uffff]/.test(char) && char !== '\u0000').length
  return printable / text.length
}

function cleanPdfText(value) {
  return compactLine(
    String(value ?? '')
      .replace(/\u0000/g, '')
      .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
  )
}

function lineKey(y) {
  return Number.isFinite(y) ? Math.round(y / 3) * 3 : 0
}

function textLineFromItems(items) {
  return items
    .sort((a, b) => a.x - b.x || a.seq - b.seq)
    .map((item) => item.text)
    .join(' ')
}

function appendTextItem(items, text, state, seq, operator) {
  const clean = cleanPdfText(text)
  if (!clean || /^https?:\/\//i.test(clean)) return false
  const width = Math.max(clean.length * 5, 8)
  const height = Math.max(state.leading, 10)

  items.push({
    text: clean,
    x: state.x,
    y: state.y,
    width,
    height,
    seq,
    operator,
  })
  state.x += width
  return true
}

function collectArrayStrings(tokens, endIndex) {
  const parts = []
  for (let index = endIndex - 1; index >= 0; index -= 1) {
    const token = tokens[index]
    if (token?.value === '[') break
    if (token?.type === 'string') {
      parts.unshift(token.value)
      continue
    }
    if (token?.type === 'number' && Math.abs(token.value) > 140) {
      parts.unshift(' ')
    }
  }
  return parts.join('')
}

function previousString(tokens, endIndex) {
  for (let index = endIndex - 1; index >= 0; index -= 1) {
    if (tokens[index]?.type === 'string') return tokens[index].value
    if (tokens[index]?.type === 'operator') break
  }
  return ''
}

function previousNumbers(tokens, endIndex, count) {
  const values = []
  for (let index = endIndex - 1; index >= 0 && values.length < count; index -= 1) {
    if (tokens[index]?.type === 'number') values.unshift(tokens[index].value)
    else if (tokens[index]?.type === 'operator') break
  }
  return values
}

function extractTextItemsFromPdfContent(content) {
  const blocks = Array.from(content.matchAll(/BT([\s\S]*?)ET/g)).map((match) => match[1])
  const textBlocks = blocks.length ? blocks : [content]
  const items = []
  const operators = new Set()
  let seq = 0
  let stringTokenCount = 0

  textBlocks.forEach((block, blockIndex) => {
    const tokens = tokenizePdfContent(block)
    const state = { x: 0, y: blockIndex * -10000, leading: 14 }
    stringTokenCount += tokens.filter((token) => token.type === 'string').length

    tokens.forEach((token, index) => {
      if (token.type !== 'operator') return
      operators.add(token.value)

      if (token.value === 'Td' || token.value === 'TD') {
        const [tx, ty] = previousNumbers(tokens, index, 2)
        if (Number.isFinite(tx)) state.x += tx
        if (Number.isFinite(ty)) state.y += ty
        if (token.value === 'TD' && Number.isFinite(ty)) state.leading = -ty
        return
      }

      if (token.value === 'Tm') {
        const matrix = previousNumbers(tokens, index, 6)
        if (matrix.length === 6) {
          state.x = matrix[4]
          state.y = matrix[5] + blockIndex * -10000
        }
        return
      }

      if (token.value === 'T*') {
        state.x = 0
        state.y -= state.leading
        return
      }

      if (token.value === 'Tj' || token.value === "'") {
        if (token.value === "'") {
          state.x = 0
          state.y -= state.leading
        }
        if (appendTextItem(items, previousString(tokens, index), state, seq, token.value)) seq += 1
        return
      }

      if (token.value === '"') {
        state.x = 0
        state.y -= state.leading
        if (appendTextItem(items, previousString(tokens, index), state, seq, token.value)) seq += 1
        return
      }

      if (token.value === 'TJ') {
        if (appendTextItem(items, collectArrayStrings(tokens, index), state, seq, token.value)) seq += 1
      }
    })
  })

  return {
    items,
    operators: Array.from(operators).sort(),
    stringTokenCount,
  }
}

function groupTextItemsIntoLineBlocks(items) {
  const byLine = new Map()
  items.forEach((item) => {
    const key = lineKey(item.y)
    const bucket = byLine.get(key) ?? []
    bucket.push(item)
    byLine.set(key, bucket)
  })

  return Array.from(byLine.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([, lineItems]) => {
      const sorted = lineItems.sort((a, b) => a.x - b.x || a.seq - b.seq)
      const text = cleanPdfText(textLineFromItems(sorted))
      const minX = Math.min(...sorted.map((item) => item.x))
      const maxX = Math.max(...sorted.map((item) => item.x + item.width))
      const minY = Math.min(...sorted.map((item) => item.y - item.height))
      const maxY = Math.max(...sorted.map((item) => item.y))

      return {
        text,
        bbox: {
          x: Number(minX.toFixed(2)),
          y: Number(maxY.toFixed(2)),
          width: Number((maxX - minX).toFixed(2)),
          height: Number((maxY - minY).toFixed(2)),
        },
        itemCount: sorted.length,
        operators: Array.from(new Set(sorted.map((item) => item.operator))).sort(),
      }
    })
    .filter((block) => block.text.length >= 2)
    .filter((block) => !/^https?:\/\//i.test(block.text))
}

function extractionConfidence({ text, decodedStreamCount, textStreamCount, warningCount }) {
  if (!text) return 'low'
  if (warningCount || textStreamCount === 0) return 'medium'
  return decodedStreamCount >= 1 ? 'high' : 'medium'
}

function buildEquationBlocks(pages) {
  const blocks = []

  pages.forEach((page) => {
    page.blocks.forEach((block, index) => {
      if (!looksEquationLike(block.text)) return
      blocks.push({
        id: `pdf-eq-${page.page}-${index + 1}`,
        page: page.page,
        text: block.text,
        bbox: block.bbox,
        lineStart: index + 1,
        lineEnd: index + 1,
        confidence: block.approximate ? 'medium' : 'high',
        operators: block.operators,
      })
    })
  })

  return blocks.slice(0, 12)
}

function readPdfLiteralStrings(text) {
  const strings = []
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '(') continue
    let depth = 1
    let value = ''
    let cursor = index + 1

    while (cursor < text.length && depth > 0) {
      const char = text[cursor]
      if (char === '\\') {
        value += char
        cursor += 1
        if (cursor < text.length) value += text[cursor]
      } else if (char === '(') {
        depth += 1
        value += char
      } else if (char === ')') {
        depth -= 1
        if (depth > 0) value += char
      } else {
        value += char
      }
      cursor += 1
    }

    if (depth === 0) {
      strings.push({
        value: decodePdfLiteral(value),
        index,
      })
      index = cursor - 1
    }
  }
  return strings
}

function extractTextLinesFromPdfContent(content) {
  const extracted = extractTextItemsFromPdfContent(content)
  const blocks = groupTextItemsIntoLineBlocks(extracted.items)

  if (blocks.length) {
    return {
      blocks,
      lines: blocks.map((block) => block.text),
      operators: extracted.operators,
      stringTokenCount: extracted.stringTokenCount,
      itemCount: extracted.items.length,
      fallback: false,
    }
  }

  const fallbackLines = readPdfLiteralStrings(content)
    .map((item) => cleanPdfText(item.value))
    .filter((line) => line.length >= 2)
    .filter((line) => !/^https?:\/\//i.test(line))

  return {
    blocks: fallbackLines.map((line, index) => ({
      text: line,
      bbox: {
        x: 0,
        y: -index * 14,
        width: Math.max(line.length * 5, 8),
        height: 14,
      },
      itemCount: 1,
      operators: [],
      approximate: true,
    })),
    lines: fallbackLines,
    operators: extracted.operators,
    stringTokenCount: extracted.stringTokenCount,
    itemCount: fallbackLines.length,
    fallback: Boolean(fallbackLines.length),
  }
}

export async function extractPdfTextFromBytes(bytes, filename = 'paper.pdf') {
  const warnings = []
  const pdfText = bytesToBinaryString(bytes)
  if (!pdfText.startsWith('%PDF')) {
    warnings.push(`${filename} does not start with a PDF header; extraction may be unreliable.`)
  }

  const objects = collectPdfObjects(pdfText)
  const contentPageMap = buildContentPageMap(objects)
  const pages = []
  const operatorSet = new Set()
  let decodedStreamCount = 0
  let textStreamCount = 0
  let fallbackStreamCount = 0
  let stringTokenCount = 0
  let textItemCount = 0
  let fallbackPage = 0

  for (const object of objects) {
    if (!/stream[\r\n]/.test(object.body)) continue
    const decoded = await decodePdfStream(object.body, warnings)
    if (!decoded) continue
    decodedStreamCount += 1
    const extracted = extractTextLinesFromPdfContent(decoded)
    const { lines } = extracted
    if (!lines.length) continue
    textStreamCount += 1
    if (extracted.fallback) fallbackStreamCount += 1
    extracted.operators.forEach((operator) => operatorSet.add(operator))
    stringTokenCount += extracted.stringTokenCount
    textItemCount += extracted.itemCount

    const page = contentPageMap.get(object.id) ?? (fallbackPage += 1)
    pages.push({
      page,
      lines,
      blocks: extracted.blocks.map((block, index) => ({
        ...block,
        line: index + 1,
      })),
      charCount: lines.join(' ').length,
    })
  }

  const orderedPages = pages.sort((a, b) => a.page - b.page)
  const text = orderedPages
    .flatMap((page) => page.lines.map((line) => `[page ${page.page}] ${line}`))
    .join('\n')

  if (!text) {
    warnings.push('No selectable text was recovered. The PDF may be scanned, encrypted, font-encoded, or image-only.')
  }

  const totalTextChars = orderedPages.reduce((sum, page) => sum + page.charCount, 0)
  const allLineBlocks = orderedPages
    .flatMap((page) =>
      page.blocks.map((block) => ({
        page: page.page,
        line: block.line,
        text: block.text,
        bbox: block.bbox,
        itemCount: block.itemCount,
        operators: block.operators,
        approximate: Boolean(block.approximate),
      }))
    )
    .slice(0, 80)
  const equationBlocks = buildEquationBlocks(orderedPages)
  const ratio = printableRatio(text)
  if (text && ratio < 0.72) {
    warnings.push('Recovered text has many non-printable characters; the PDF may use custom font encodings.')
  }
  if (text && fallbackStreamCount) {
    warnings.push('Some text came from fallback literal extraction; line ordering may be approximate.')
  }
  if (objects.length && contentPageMap.size === 0) {
    warnings.push('PDF page-to-content references were not found; page numbers may be approximate.')
  }

  const qualityWarnings = Array.from(new Set(warnings)).slice(0, 6)

  return {
    text,
    pages: orderedPages.map((page) => ({
      page: page.page,
      lineCount: page.lines.length,
      charCount: page.charCount,
      blocks: page.blocks.slice(0, 24).map((block) => ({
        line: block.line,
        text: truncate(block.text, 220),
        bbox: block.bbox,
        approximate: Boolean(block.approximate),
      })),
    })),
    blocks: allLineBlocks,
    equationBlocks,
    quality: {
      confidence: extractionConfidence({
        text,
        decodedStreamCount,
        textStreamCount,
        warningCount: qualityWarnings.length,
      }),
      objectCount: objects.length,
      contentStreamCount: contentPageMap.size,
      decodedStreamCount,
      textStreamCount,
      fallbackStreamCount,
      textItemCount,
      equationBlockCount: equationBlocks.length,
      stringTokenCount,
      lineCount: orderedPages.reduce((sum, page) => sum + page.lines.length, 0),
      textChars: totalTextChars,
      printableRatio: Number(ratio.toFixed(3)),
      operators: Array.from(operatorSet).slice(0, 16),
      needsOcr: !text,
    },
    warnings: qualityWarnings,
  }
}

function allowedPdfUrl(url, env) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    throw new PublicError('invalid_pdf_url', 400)
  }

  if (parsed.protocol !== 'https:') {
    throw new PublicError('invalid_pdf_url', 400)
  }

  const allowedHosts = parseList(env.PDF_ALLOWED_HOSTS, DEFAULT_PDF_ALLOWED_HOSTS)
  if (isIpLiteralHostname(parsed.hostname) || !allowedHosts.includes(parsed.hostname)) {
    throw new PublicError('invalid_pdf_url', 400)
  }

  return parsed.toString()
}

function isIpLiteralHostname(hostname) {
  const normalized = String(hostname ?? '').replace(/^\[/, '').replace(/\]$/, '')
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalized) || normalized.includes(':')
}

function timeoutSignal(timeoutMs) {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(timeoutMs)
    : undefined
}

function isRedirectStatus(status) {
  return status >= 300 && status < 400
}

function isAllowedPdfContentType(value) {
  const contentType = String(value ?? '').toLowerCase().split(';')[0].trim()
  return ['application/pdf', 'application/x-pdf', 'application/octet-stream'].includes(contentType)
}

async function readResponseBytesWithLimit(response, maxBytes) {
  if (!response.body || typeof response.body.getReader !== 'function') {
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.length > maxBytes) throw new PublicError('pdf_too_large', 413)
    return bytes
  }

  const reader = response.body.getReader()
  const chunks = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = value instanceof Uint8Array ? value : new Uint8Array(value)
    received += chunk.byteLength
    if (received > maxBytes) {
      await reader.cancel().catch(() => {})
      throw new PublicError('pdf_too_large', 413)
    }
    chunks.push(chunk)
  }

  const bytes = new Uint8Array(received)
  let offset = 0
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  })

  return bytes
}

async function fetchPdfBytes(pdfUrl, env, fetchImpl, redirectCount = 0) {
  const url = allowedPdfUrl(pdfUrl, env)
  const maxPdfBytes = parseNumber(env.MAX_PDF_BYTES, DEFAULT_MAX_PDF_BYTES)
  const timeoutMs = parseNumber(env.PDF_FETCH_TIMEOUT_MS, DEFAULT_PDF_FETCH_TIMEOUT_MS)
  const response = await fetchImpl(url, {
    redirect: 'manual',
    signal: timeoutSignal(timeoutMs),
    headers: {
      accept: 'application/pdf,*/*;q=0.8',
      'user-agent': 'ContinuousFunctionPaperMapper/1.0',
    },
  })

  if (isRedirectStatus(response.status)) {
    const maxRedirects = parseNumber(env.PDF_MAX_REDIRECTS, DEFAULT_PDF_MAX_REDIRECTS)
    const location = response.headers.get('location')
    if (!location || redirectCount >= maxRedirects) throw new PublicError('invalid_pdf', 400)
    return fetchPdfBytes(new URL(location, url).toString(), env, fetchImpl, redirectCount + 1)
  }

  if (!response.ok) throw new PublicError('invalid_pdf', 400)

  if (!isAllowedPdfContentType(response.headers.get('content-type'))) {
    throw new PublicError('invalid_pdf_type', 415)
  }

  const contentLengthHeader = response.headers.get('content-length')
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader)
    if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > maxPdfBytes) {
      throw new PublicError('pdf_too_large', 413)
    }
  }

  return readResponseBytesWithLimit(response, maxPdfBytes)
}

async function callOcrFallback(bytes, source, env, fetchImpl) {
  let endpoint = env.PDF_OCR_ENDPOINT?.trim()
  if (!endpoint) {
    return {
      status: 'not_configured',
      text: '',
      pages: [],
      warnings: ['OCR fallback is not configured. Set PDF_OCR_ENDPOINT to process scanned PDFs.'],
    }
  }

  const maxOcrBytes = parseNumber(env.PDF_OCR_MAX_BYTES, parseNumber(env.MAX_PDF_BYTES, DEFAULT_MAX_PDF_BYTES))
  if (bytes.length > maxOcrBytes) {
    return {
      status: 'failed',
      text: '',
      pages: [],
      warnings: ['OCR fallback skipped because the PDF exceeds the OCR size limit.'],
    }
  }

  try {
    const parsed = new URL(endpoint)
    const allowedHosts = parseList(env.PDF_OCR_ALLOWED_HOSTS, [])
    if (parsed.protocol !== 'https:' || isIpLiteralHostname(parsed.hostname) || !allowedHosts.includes(parsed.hostname)) {
      throw new Error('invalid_ocr_endpoint')
    }
    endpoint = parsed.toString()
  } catch {
    return {
      status: 'failed',
      text: '',
      pages: [],
      warnings: ['OCR fallback endpoint is not allowlisted.'],
    }
  }

  const response = await fetchImpl(endpoint, {
    method: 'POST',
    signal: timeoutSignal(parseNumber(env.PDF_OCR_TIMEOUT_MS, DEFAULT_PDF_FETCH_TIMEOUT_MS)),
    headers: {
      'content-type': 'application/json',
      ...(env.PDF_OCR_API_KEY ? { authorization: `Bearer ${env.PDF_OCR_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      fileName: source.filename ?? 'paper.pdf',
      mimeType: source.mimeType ?? 'application/pdf',
      pdfBase64: bytesToBase64(bytes),
      maxPages: parseNumber(env.PDF_OCR_MAX_PAGES, 8),
    }),
  })

  if (!response.ok) {
    return {
      status: 'failed',
      text: '',
      pages: [],
      warnings: [`OCR fallback failed with ${response.status}.`],
    }
  }

  const payload = await response.json()
  const pageRecords = Array.isArray(payload.pages) ? payload.pages : []
  const pages = pageRecords
    .map((page, index) => ({
      page: Number(page.page ?? index + 1),
      lines: Array.isArray(page.lines)
        ? page.lines.map((line) => compactLine(String(line))).filter(Boolean)
        : String(page.text ?? '')
            .split(/\n/)
            .map((line) => compactLine(line))
            .filter(Boolean),
    }))
    .filter((page) => page.lines.length)

  const text = pages.flatMap((page) => page.lines.map((line) => `[page ${page.page}] ${line}`)).join('\n')

  return {
    status: text ? 'parsed' : 'failed',
    text,
    pages: pages.map((page) => ({
      page: page.page,
      lineCount: page.lines.length,
      charCount: page.lines.join(' ').length,
    })),
    warnings: Array.isArray(payload.warnings) ? payload.warnings.slice(0, 6) : [],
  }
}

async function resolvePdfExtraction(source, env, fetchImpl) {
  const maxPdfBytes = parseNumber(env.MAX_PDF_BYTES, DEFAULT_MAX_PDF_BYTES)
  const pdfBase64 = typeof source.pdfBase64 === 'string' ? source.pdfBase64 : undefined
  const pdfUrl = source.pdfUrl

  if (!pdfBase64 && !pdfUrl) {
    return {
      status: 'skipped',
      source: 'none',
      text: '',
      pages: [],
      warnings: [],
    }
  }

  const bytes = pdfBase64 ? base64ToBytes(pdfBase64) : await fetchPdfBytes(pdfUrl, env, fetchImpl)
  if (bytes.length > maxPdfBytes) {
    throw new PublicError('pdf_too_large', 413)
  }

  const extraction = await extractPdfTextFromBytes(bytes, source.filename ?? source.pdfUrl ?? 'paper.pdf')
  const ocr =
    extraction.quality?.needsOcr || (!extraction.text && env.PDF_OCR_ENDPOINT)
      ? await callOcrFallback(bytes, source, env, fetchImpl)
      : {
          status: extraction.quality?.needsOcr ? 'not_configured' : 'not_needed',
          text: '',
          pages: [],
          warnings: [],
        }
  const text = extraction.text || ocr.text
  const pages = extraction.text ? extraction.pages : ocr.pages
  const warnings = [...extraction.warnings, ...ocr.warnings]

  return {
    status: text ? 'parsed' : 'failed',
    source: pdfBase64 ? 'inline_base64' : 'remote_url',
    fileName: source.filename,
    url: pdfUrl,
    byteLength: bytes.length,
    textChars: text.length,
    pages,
    blocks: extraction.blocks,
    equationBlocks: extraction.equationBlocks,
    quality: extraction.quality,
    ocr: {
      status: ocr.status,
      pageCount: ocr.pages.length,
    },
    text,
    warnings,
  }
}

function decodeXml(text) {
  return String(text ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function stripTags(text) {
  return decodeXml(String(text ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function firstTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match ? stripTags(match[1]) : undefined
}

function allTags(xml, tag) {
  return Array.from(xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'gi'))).map((match) =>
    stripTags(match[1])
  )
}

export function validatePaperMapperRequest(payload, env = {}) {
  if (!isRecord(payload)) throw new PublicError('invalid_request', 400)
  if (payload.version !== CONTRACT_VERSION) throw new PublicError('invalid_request', 400)
  if (!isRecord(payload.source) || typeof payload.source.raw !== 'string') throw new PublicError('invalid_request', 400)

  const maxSourceChars = parseNumber(env.MAX_SOURCE_CHARS, DEFAULT_MAX_SOURCE_CHARS)
  const maxPdfBytes = parseNumber(env.MAX_PDF_BYTES, DEFAULT_MAX_PDF_BYTES)
  const raw = truncate(payload.source.raw.trim(), maxSourceChars)
  const suppliedArxivId = typeof payload.source.arxivId === 'string' ? payload.source.arxivId.trim() : undefined
  const arxivId = suppliedArxivId || parseArxivId(raw)
  const pdfBase64 = typeof payload.source.pdfBase64 === 'string' ? payload.source.pdfBase64.trim() : undefined
  const pdfUrl = resolvePdfUrl(raw, payload.source.pdfUrl, arxivId)
  const filename = typeof payload.source.filename === 'string' ? truncate(payload.source.filename.trim(), 180) : undefined
  const mimeType = typeof payload.source.mimeType === 'string' ? truncate(payload.source.mimeType.trim(), 80) : undefined
  const kind = detectKind(raw, payload.source.kind)
  const hints = isRecord(payload.hints) ? payload.hints : {}

  if (pdfBase64 && byteLengthFromBase64(pdfBase64) > maxPdfBytes) {
    throw new PublicError('pdf_too_large', 413)
  }

  return {
    version: CONTRACT_VERSION,
    source: {
      raw,
      kind,
      arxivId,
      pdfUrl,
      pdfBase64,
      filename,
      mimeType,
    },
    hints: {
      matchedTerms: Array.isArray(hints.matchedTerms)
        ? hints.matchedTerms.filter((item) => typeof item === 'string' && item.trim()).slice(0, 20)
        : [],
    },
  }
}

export async function fetchArxivMetadata(arxivId, fetchImpl = fetch) {
  if (!arxivId) return undefined
  const response = await fetchImpl(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(arxivId)}`)
  if (!response.ok) throw new Error(`arXiv metadata lookup failed with ${response.status}.`)

  const xml = await response.text()
  const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/i)?.[1]
  if (!entry) return undefined

  return {
    source: 'arxiv',
    arxivId,
    title: firstTag(entry, 'title'),
    abstract: firstTag(entry, 'summary'),
    authors: Array.from(entry.matchAll(/<author>([\s\S]*?)<\/author>/gi))
      .map((match) => firstTag(match[1], 'name'))
      .filter(Boolean)
      .slice(0, 12),
    published: firstTag(entry, 'published'),
    updated: firstTag(entry, 'updated'),
    categories: allTags(entry, 'category').map((item) => item.replace(/^term\s*=\s*/i, '')).slice(0, 8),
    url: `https://arxiv.org/abs/${arxivId}`,
    pdfUrl: `https://arxiv.org/pdf/${arxivId}`,
  }
}

export function buildEvidenceMapping(request, metadata, extractedText = '') {
  const haystack = [request.source.raw, extractedText, metadata?.title, metadata?.abstract, request.hints.matchedTerms.join(' ')].join(' ').toLowerCase()
  const concepts = conceptLexicon
    .map((concept) => ({
      ...concept,
      score: concept.terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0),
    }))
    .filter((concept) => concept.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)

  return {
    summary: concepts.length
      ? `Mapped to ${concepts.map((concept) => concept.label).join(', ')} from source terms and metadata.`
      : 'No high-confidence concept cluster yet; more source text is needed.',
    confidence: concepts.length >= 3 ? 'high' : concepts.length >= 1 ? 'medium' : 'low',
    concepts: concepts.map(({ id, label, score }) => ({ id, label, score })),
    claims: [
      {
        claim: metadata?.title ? `Paper title resolved as "${metadata.title}".` : 'Paper title is not yet verified.',
        confidence: metadata?.title ? 'high' : 'low',
        sourceIds: metadata?.title ? ['arxiv-metadata'] : ['user-input'],
      },
      {
        claim: 'Concept routing is based on matched source terms plus Continuous Function concept vocabulary.',
        confidence: concepts.length ? 'medium' : 'low',
        sourceIds: ['user-input', metadata ? 'arxiv-metadata' : 'local-terms'],
      },
    ],
  }
}

function safeObjectId(value, index) {
  const slug = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42)

  return `eqobj-${slug || 'equation'}-${index + 1}`
}

function sourceLineLabel(page, lineStart, lineEnd) {
  const lineLabel = lineEnd && lineEnd !== lineStart ? `lines ${lineStart}-${lineEnd}` : `line ${lineStart ?? 1}`
  return page ? `Page ${page}, ${lineLabel}` : `Source ${lineLabel}`
}

function normalizeConfidence(value, fallback = 'medium') {
  return value === 'high' ? 'high' : fallback
}

function equationObjectPrompt(equation, route) {
  const routeText = route.length ? ` Connect it to this concept route: ${route.join(' -> ')}.` : ''
  return `Explain this equation from the paper step by step. Define every symbol, name tensor or scalar shapes when possible, say what assumption the equation depends on, and point to the smallest prerequisite repair.${routeText}\n\nEquation: ${equation}`
}

function buildEquationObjects({ equationSpans, pdfExtraction, mapping, metadata, source }) {
  const concepts = Array.isArray(mapping?.concepts) ? mapping.concepts : []
  const conceptIds = concepts.map((concept) => concept.id).filter(Boolean).slice(0, 8)
  const route = concepts.map((concept) => concept.label).filter(Boolean).slice(0, 8)
  const paper = metadata?.title || source.filename || source.pdfUrl || source.raw || 'paper'
  const objects = []
  const seen = new Set()

  const pushObject = ({ equation, label, confidence, sourceBox }) => {
    const compactEquation = compactLine(equation)
    if (!compactEquation) return
    const key = compactEquation.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    const index = objects.length
    objects.push({
      id: safeObjectId(sourceBox.sourceId || compactEquation, index),
      label,
      equation: truncate(compactEquation, 220),
      confidence,
      source: sourceBox,
      prompt: equationObjectPrompt(compactEquation, route),
      graphAttachment: {
        type: 'equation',
        conceptIds,
        paper: truncate(paper, 180),
        route,
      },
    })
  }

  const pdfBlocks = Array.isArray(pdfExtraction?.equationBlocks) ? pdfExtraction.equationBlocks : []
  pdfBlocks.forEach((block) => {
    pushObject({
      equation: block.text,
      label: sourceLineLabel(block.page, block.lineStart, block.lineEnd),
      confidence: normalizeConfidence(block.confidence, 'medium'),
      sourceBox: {
        kind: 'pdf',
        sourceId: block.id,
        page: block.page,
        lineStart: block.lineStart,
        lineEnd: block.lineEnd,
        bbox: block.bbox,
      },
    })
  })

  equationSpans.forEach((span) => {
    const kind = span.sourceId === 'arxiv-metadata' ? 'metadata' : source.kind === 'pdf' ? 'pdf' : 'pasted-text'
    pushObject({
      equation: span.equation,
      label: sourceLineLabel(span.page, span.lineStart, span.lineEnd),
      confidence: span.page ? 'high' : 'medium',
      sourceBox: {
        kind,
        sourceId: span.sourceId,
        page: span.page,
        lineStart: span.lineStart,
        lineEnd: span.lineEnd,
      },
    })
  })

  return objects.slice(0, 10)
}

export function buildOpenAIMapperRequest(request, metadata, mapping, env, extracted = {}) {
  const model = env.OPENAI_MODEL?.trim()
  if (!model) throw new Error('OPENAI_MODEL is not configured.')
  const sourceExcerpt = [request.source.raw, extracted.pdfText].filter(Boolean).join('\n')

  return {
    model,
    instructions: [
      'You are the Continuous Function paper mapper.',
      'Return JSON only with keys summary, prerequisitePath, equations, caution.',
      'Use only the supplied source packet, arXiv metadata, extracted equations, and concept candidates.',
      'Do not invent author, venue, benchmark, or empirical claims.',
    ].join(' '),
    input: JSON.stringify({
      source: { kind: request.source.kind, arxivId: request.source.arxivId, pdfUrl: request.source.pdfUrl, excerpt: truncate(sourceExcerpt, 6000) },
      metadata,
      mapping,
      pdfExtraction: extracted.pdfSummary,
      equationObjects: extracted.equationObjects,
      equations: extractCombinedEquationSpans(sourceExcerpt, metadata),
    }),
    max_output_tokens: parseNumber(env.OPENAI_MAX_OUTPUT_TOKENS, DEFAULT_MAX_OUTPUT_TOKENS),
    store: false,
    metadata: {
      app: 'continuous-function',
      source: 'paper-mapper',
    },
  }
}

async function callOpenAIMapper(request, metadata, mapping, env, fetchImpl = fetch, extracted = {}) {
  if (!env.OPENAI_API_KEY || !env.OPENAI_MODEL) return undefined

  const baseUrl = env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1'
  const response = await fetchImpl(`${baseUrl}/responses`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(buildOpenAIMapperRequest(request, metadata, mapping, env, extracted)),
  })

  if (!response.ok) throw new PublicError('upstream_unavailable', 502)
  const payload = await response.json()
  return typeof payload.output_text === 'string' ? payload.output_text : undefined
}

export async function handlePaperMapperRequest(request, env = {}, fetchImpl = fetch) {
  const origin = getAllowedOrigin(request, env)
  if (!origin) return jsonResponse({ error: 'origin_not_allowed' }, 403, 'null')
  if (!checkRateLimit(request, env)) return jsonResponse({ error: 'Rate limit exceeded.' }, 429, origin)

  let payload
  try {
    payload = await readJsonWithLimit(request, env)
  } catch (error) {
    const publicError = toPublicError(error)
    return jsonResponse({ error: publicError.code }, publicError.status, origin)
  }

  let normalized
  try {
    normalized = validatePaperMapperRequest(payload, env)
  } catch (error) {
    const publicError = toPublicError(error)
    return jsonResponse({ error: publicError.code }, publicError.status, origin)
  }

  let metadata
  let pdfExtraction
  let ai
  let mapping
  let equationObjects
  let sourceSpans
  let equationSpans
  let equations
  let pdfSummary

  try {
    metadata = normalized.source.arxivId ? await fetchArxivMetadata(normalized.source.arxivId, fetchImpl) : undefined
    pdfExtraction = await resolvePdfExtraction(normalized.source, env, fetchImpl)
    const sourceText = [normalized.source.raw, pdfExtraction.text].filter(Boolean).join('\n')
    sourceSpans = [...extractSourceSpans(sourceText), ...extractMetadataSourceSpans(metadata)].slice(0, 8)
    equationSpans = extractCombinedEquationSpans(sourceText, metadata)
    equations = equationSpans.map((span) => span.equation).slice(0, 8)
    mapping = buildEvidenceMapping(normalized, metadata, pdfExtraction.text)
    equationObjects = buildEquationObjects({
      equationSpans,
      pdfExtraction,
      mapping,
      metadata,
      source: normalized.source,
    })
    pdfSummary = {
      status: pdfExtraction.status,
      source: pdfExtraction.source,
      fileName: pdfExtraction.fileName,
      url: pdfExtraction.url,
      byteLength: pdfExtraction.byteLength,
      textChars: pdfExtraction.textChars,
      pages: pdfExtraction.pages,
      blocks: pdfExtraction.blocks,
      equationBlocks: pdfExtraction.equationBlocks,
      quality: pdfExtraction.quality,
      ocr: pdfExtraction.ocr,
      warnings: pdfExtraction.warnings,
    }
    ai = await callOpenAIMapper(normalized, metadata, mapping, env, fetchImpl, {
      pdfText: pdfExtraction.text,
      pdfSummary,
      equationObjects,
    })
  } catch (error) {
    const publicError = toPublicError(error)
    return jsonResponse({ error: publicError.code }, publicError.status, origin)
  }

  return jsonResponse(
    {
      version: CONTRACT_VERSION,
      source: {
        kind: normalized.source.kind,
        arxivId: normalized.source.arxivId,
        canonicalUrl: normalized.source.arxivId ? `https://arxiv.org/abs/${normalized.source.arxivId}` : undefined,
        pdfUrl: normalized.source.pdfUrl,
      },
      metadata,
      extracted: {
        pdf: pdfSummary,
        equationCandidates: equations,
        equationSpans,
        equationObjects,
        sourceSpans,
        matchedTerms: normalized.hints.matchedTerms,
      },
      mapping,
      ai,
      warnings: [
        metadata ? undefined : 'No external metadata was resolved; claims should stay at local-preview confidence.',
        pdfExtraction.status === 'failed' ? 'PDF extraction ran, but no selectable text was recovered.' : undefined,
        ...pdfExtraction.warnings,
        ai ? undefined : 'OPENAI_API_KEY and OPENAI_MODEL were not both configured, so AI mapping was skipped.',
      ].filter(Boolean),
    },
    200,
    origin
  )
}

export default {
  async fetch(request, env = {}) {
    if (request.method === 'OPTIONS') {
      const origin = getAllowedOrigin(request, env)
      if (!origin) return jsonResponse({ error: 'origin_not_allowed' }, 403, 'null')
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    if (request.method === 'GET') {
      const origin = getAllowedOrigin(request, env, { allowMissingOrigin: true }) || 'null'
      return jsonResponse({ ok: true, version: CONTRACT_VERSION }, 200, origin)
    }

    const origin = getAllowedOrigin(request, env)
    if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405, origin || 'null')

    return handlePaperMapperRequest(request, env)
  },
}
