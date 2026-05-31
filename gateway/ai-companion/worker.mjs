const CONTRACT_VERSION = 'continuous-function.ai-companion.v1'
const DEFAULT_ALLOWED_ORIGINS = [
  'https://continuousfunction.ai',
  'https://www.continuousfunction.ai',
  'http://localhost:3003',
  'http://127.0.0.1:3003',
]
const DEFAULT_MAX_PROMPT_CHARS = 12000
const DEFAULT_RATE_LIMIT_PER_MINUTE = 30
const DEFAULT_MAX_OUTPUT_TOKENS = 700
const DEFAULT_MAX_JSON_BODY_BYTES = 256 * 1024

const buckets = new Map()

class PublicError extends Error {
  constructor(code, status = 400) {
    super(code)
    this.code = code
    this.status = status
  }
}

function parseList(value, fallback) {
  if (!value || typeof value !== 'string') return fallback
  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return parsed.length ? parsed : fallback
}

function parseNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function getOrigin(request) {
  return request.headers.get('origin') ?? ''
}

function getAllowedOrigin(request, env, options = {}) {
  const origin = getOrigin(request)
  if (!origin) return options.allowMissingOrigin ? '*' : ''

  const allowedOrigins = parseList(env.ALLOWED_ORIGINS, DEFAULT_ALLOWED_ORIGINS)
  return allowedOrigins.includes(origin) ? origin : ''
}

function corsHeaders(origin) {
  return {
    'access-control-allow-origin': origin || 'null',
    'access-control-allow-methods': 'POST, OPTIONS, GET',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    'vary': 'Origin',
  }
}

function jsonResponse(payload, status, origin = '*', extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(origin),
      ...extraHeaders,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function textResponse(body, status, origin = '*', extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders(origin),
      ...extraHeaders,
      'content-type': 'text/plain; charset=utf-8',
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
  const key = `${clientKey(request, env)}:${Math.floor(Date.now() / 60000)}`
  const count = buckets.get(key) ?? 0
  buckets.set(key, count + 1)

  if (buckets.size > 5000) {
    const currentMinute = Math.floor(Date.now() / 60000)
    for (const bucketKey of buckets.keys()) {
      if (!bucketKey.endsWith(`:${currentMinute}`)) buckets.delete(bucketKey)
    }
  }

  return count < limit
}

function maxJsonBodyBytes(env) {
  return parseNumber(env.MAX_JSON_BODY_BYTES, DEFAULT_MAX_JSON_BODY_BYTES)
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

function sanitizeStringArray(value, maxItems = 12, maxItemLength = 120) {
  if (!Array.isArray(value)) return undefined
  const result = value
    .filter((item) => typeof item === 'string' && item.trim())
    .slice(0, maxItems)
    .map((item) => truncate(item.trim(), maxItemLength))

  return result.length ? result : undefined
}

export function validateCompanionRequest(payload, env = {}) {
  if (!isRecord(payload)) {
    throw new Error('Request body must be a JSON object.')
  }

  if (payload.version !== CONTRACT_VERSION) {
    throw new Error(`Unsupported contract version. Expected ${CONTRACT_VERSION}.`)
  }

  if (payload.mode !== 'home' && payload.mode !== 'concept') {
    throw new Error('mode must be "home" or "concept".')
  }

  if (!['home-panel', 'concept-panel', 'concept-section'].includes(payload.source)) {
    throw new Error('source is not recognized.')
  }

  if (!isRecord(payload.task) || typeof payload.task.instruction !== 'string') {
    throw new Error('task.instruction is required.')
  }

  if (!isRecord(payload.context) || typeof payload.context.surfaceTitle !== 'string') {
    throw new Error('context.surfaceTitle is required.')
  }

  if (typeof payload.prompt !== 'string' || !payload.prompt.trim()) {
    throw new Error('prompt is required.')
  }

  const maxPromptChars = parseNumber(env.MAX_PROMPT_CHARS, DEFAULT_MAX_PROMPT_CHARS)
  if (payload.prompt.length > maxPromptChars) {
    throw new Error(`prompt exceeds ${maxPromptChars} characters.`)
  }

  const learner = isRecord(payload.learner) ? payload.learner : {}
  const context = payload.context
  const task = payload.task

  return {
    version: CONTRACT_VERSION,
    source: payload.source,
    mode: payload.mode,
    prompt: payload.prompt.trim(),
    task: {
      id: typeof task.id === 'string' ? truncate(task.id.trim(), 80) : 'custom',
      label: typeof task.label === 'string' ? truncate(task.label.trim(), 80) : 'Custom',
      instruction: truncate(task.instruction.trim(), 1200),
    },
    context: {
      contextLabel: typeof context.contextLabel === 'string' ? truncate(context.contextLabel.trim(), 180) : undefined,
      domainTitle: typeof context.domainTitle === 'string' ? truncate(context.domainTitle.trim(), 120) : undefined,
      surfaceTitle: truncate(context.surfaceTitle.trim(), 160),
      description: typeof context.description === 'string' ? truncate(context.description.trim(), 900) : undefined,
      currentSection: typeof context.currentSection === 'string' ? truncate(context.currentSection.trim(), 120) : undefined,
      sectionStep: typeof context.sectionStep === 'string' ? truncate(context.sectionStep.trim(), 40) : undefined,
      sectionSummary: typeof context.sectionSummary === 'string' ? truncate(context.sectionSummary.trim(), 500) : undefined,
      sectionSnippet: typeof context.sectionSnippet === 'string' ? truncate(context.sectionSnippet.trim(), 2200) : undefined,
      prerequisites: sanitizeStringArray(context.prerequisites),
      nextConcept: typeof context.nextConcept === 'string' ? truncate(context.nextConcept.trim(), 160) : undefined,
      nextStep: typeof context.nextStep === 'string' ? truncate(context.nextStep.trim(), 280) : undefined,
    },
    learner: {
      question: typeof learner.question === 'string' ? truncate(learner.question.trim(), 2000) : undefined,
      selectedText: typeof learner.selectedText === 'string' ? truncate(learner.selectedText.trim(), 2000) : undefined,
      goal: typeof learner.goal === 'string' ? truncate(learner.goal.trim(), 120) : undefined,
      comfortLevel: typeof learner.comfortLevel === 'string' ? truncate(learner.comfortLevel.trim(), 120) : undefined,
      explanationStyle: typeof learner.explanationStyle === 'string' ? truncate(learner.explanationStyle.trim(), 120) : undefined,
      stuckReason: typeof learner.stuckReason === 'string' ? truncate(learner.stuckReason.trim(), 160) : undefined,
    },
  }
}

export function buildOpenAIRequest(companionRequest, env) {
  const model = env.OPENAI_MODEL?.trim()
  if (!model) {
    throw new Error('OPENAI_MODEL is not configured.')
  }

  const body = {
    model,
    instructions: [
      'You are the Continuous Function AI learning companion.',
      'Help STEM learners understand the supplied page context without replacing the page.',
      'Return JSON only: {"answer": "...", "nextAction": "...", "followups": ["..."]}.',
      'Keep the answer compact, concrete, and page-grounded.',
      'Use intuition before notation, define symbols, and avoid inventing graph links or prerequisites.',
      'Never ask for secrets, API keys, passwords, payment data, or private identifiers.',
    ].join(' '),
    input: companionRequest.prompt,
    max_output_tokens: parseNumber(env.OPENAI_MAX_OUTPUT_TOKENS, DEFAULT_MAX_OUTPUT_TOKENS),
    store: false,
    metadata: {
      app: 'continuous-function',
      source: companionRequest.source,
      mode: companionRequest.mode,
      task: companionRequest.task.id,
    },
  }

  if (env.OPENAI_TEMPERATURE) {
    body.temperature = parseNumber(env.OPENAI_TEMPERATURE, 0.35)
  }

  return body
}

function parseJsonMaybe(text) {
  if (!text || typeof text !== 'string') return null
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()

  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

export function extractOpenAIText(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text

  const output = Array.isArray(payload?.output) ? payload.output : []
  const chunks = []

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : []
    for (const part of content) {
      if (part?.type === 'output_text' && typeof part.text === 'string') chunks.push(part.text)
      if (part?.type === 'text' && typeof part.text === 'string') chunks.push(part.text)
    }
  }

  return chunks.join('\n').trim()
}

export function normalizeCompanionResponse(text) {
  const parsed = parseJsonMaybe(text)
  if (isRecord(parsed)) {
    const followups = sanitizeStringArray(parsed.followups, 4, 180)
    return {
      answer: typeof parsed.answer === 'string' && parsed.answer.trim() ? parsed.answer.trim() : text.trim(),
      nextAction: typeof parsed.nextAction === 'string' ? parsed.nextAction.trim() : undefined,
      followups,
    }
  }

  return {
    answer: text.trim() || 'I could not produce a useful answer. Try copying the prompt and asking again.',
  }
}

async function callOpenAI(companionRequest, env, fetchImpl) {
  const apiKey = env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured.')
  }

  const baseUrl = env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1'
  const openAIRequest = buildOpenAIRequest(companionRequest, env)
  const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/responses`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(openAIRequest),
  })

  const responseText = await response.text()
  let payload = responseText

  try {
    payload = responseText ? JSON.parse(responseText) : {}
  } catch {
    payload = responseText
  }

  if (!response.ok) {
    const message =
      typeof payload?.error?.message === 'string'
        ? payload.error.message
        : `OpenAI request failed with ${response.status}.`
    throw new Error(message)
  }

  return normalizeCompanionResponse(extractOpenAIText(payload))
}

export async function handleRequest(request, env = {}, ctx = {}, fetchImpl = fetch) {
  if (request.method === 'OPTIONS') {
    const origin = getAllowedOrigin(request, env)
    if (!origin) return jsonResponse({ error: 'origin_not_allowed' }, 403, 'null')
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }

  if (request.method === 'GET') {
    const origin = getAllowedOrigin(request, env, { allowMissingOrigin: true }) || 'null'
    return jsonResponse({ ok: true, service: 'continuous-function-ai-companion' }, 200, origin)
  }

  const origin = getAllowedOrigin(request, env)
  if (!origin) {
    return jsonResponse({ error: 'origin_not_allowed' }, 403, 'null')
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405, origin, { allow: 'POST, OPTIONS, GET' })
  }

  if (!checkRateLimit(request, env)) {
    return jsonResponse({ error: 'Rate limit exceeded.' }, 429, origin, { 'retry-after': '60' })
  }

  let payload
  try {
    payload = await readJsonWithLimit(request, env)
  } catch (error) {
    const publicError = toPublicError(error)
    return jsonResponse({ error: publicError.code }, publicError.status, origin)
  }

  let companionRequest
  try {
    companionRequest = validateCompanionRequest(payload, env)
  } catch {
    return jsonResponse({ error: 'invalid_request' }, 400, origin)
  }

  try {
    const result = await callOpenAI(companionRequest, env, fetchImpl)
    return jsonResponse(result, 200, origin)
  } catch {
    return jsonResponse({ error: 'upstream_unavailable' }, 502, origin)
  }
}

export default {
  fetch: handleRequest,
}
