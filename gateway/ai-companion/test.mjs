import assert from 'node:assert/strict'
import { buildOpenAIRequest, handleRequest, normalizeCompanionResponse, validateCompanionRequest } from './worker.mjs'

const companionRequest = {
  version: 'continuous-function.ai-companion.v1',
  source: 'concept-section',
  mode: 'concept',
  prompt: 'You are my AI learning companion for Continuous Function.\nLearning surface: Dot Product.\nTask: Explain the mechanism.',
  task: {
    id: 'explain',
    label: 'Explain',
    instruction: 'Explain the mechanism.',
  },
  context: {
    domainTitle: 'Linear Algebra',
    surfaceTitle: 'Dot Product',
    currentSection: 'Intuition',
    prerequisites: ['Vector Spaces'],
    nextConcept: 'Norms',
  },
  learner: {
    question: 'Why is it cosine similarity?',
    goal: 'Understand the idea',
    comfortLevel: 'Somewhat familiar',
    explanationStyle: 'Visual first',
    stuckReason: 'Equation jump',
  },
}

const env = {
  ALLOWED_ORIGINS: 'http://localhost:3003',
  OPENAI_API_KEY: 'test-key',
  OPENAI_MODEL: 'test-model',
  RATE_LIMIT_PER_MINUTE: '100',
}

const sanitized = validateCompanionRequest(companionRequest, env)
assert.equal(sanitized.context.surfaceTitle, 'Dot Product')
assert.equal(sanitized.learner.question, 'Why is it cosine similarity?')
assert.equal(sanitized.learner.explanationStyle, 'Visual first')

const openAIRequest = buildOpenAIRequest(sanitized, env)
assert.equal(openAIRequest.model, 'test-model')
assert.equal(openAIRequest.store, false)
assert.match(openAIRequest.input, /Dot Product/)

assert.deepEqual(
  normalizeCompanionResponse('{"answer":"Alignment becomes cosine when lengths are divided out.","nextAction":"Drag the vectors."}'),
  {
    answer: 'Alignment becomes cosine when lengths are divided out.',
    nextAction: 'Drag the vectors.',
    followups: undefined,
  }
)

const optionsResponse = await handleRequest(
  new Request('https://gateway.example.test/', {
    method: 'OPTIONS',
    headers: { origin: 'http://localhost:3003' },
  }),
  env
)
assert.equal(optionsResponse.status, 204)
assert.equal(optionsResponse.headers.get('access-control-allow-origin'), 'http://localhost:3003')

const forbiddenResponse = await handleRequest(
  new Request('https://gateway.example.test/', {
    method: 'POST',
    headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
    body: JSON.stringify(companionRequest),
  }),
  env
)
assert.equal(forbiddenResponse.status, 403)

const missingOriginResponse = await handleRequest(
  new Request('https://gateway.example.test/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(companionRequest),
  }),
  env
)
assert.equal(missingOriginResponse.status, 403)

const oversizedResponse = await handleRequest(
  new Request('https://gateway.example.test/', {
    method: 'POST',
    headers: { origin: 'http://localhost:3003', 'content-type': 'application/json' },
    body: JSON.stringify(companionRequest),
  }),
  { ...env, MAX_JSON_BODY_BYTES: '32' }
)
assert.equal(oversizedResponse.status, 413)
assert.equal((await oversizedResponse.json()).error, 'request_too_large')

const upstreamCalls = []
const okResponse = await handleRequest(
  new Request('https://gateway.example.test/', {
    method: 'POST',
    headers: { origin: 'http://localhost:3003', 'content-type': 'application/json', 'cf-connecting-ip': '127.0.0.1' },
    body: JSON.stringify(companionRequest),
  }),
  env,
  {},
  async (url, init) => {
    upstreamCalls.push({ url, body: JSON.parse(init.body) })
    return new Response(JSON.stringify({
      output: [
        {
          content: [
            {
              type: 'output_text',
              text: '{"answer":"A dot product is alignment with length still attached.","nextAction":"Predict the sign before dragging."}',
            },
          ],
        },
      ],
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
)

assert.equal(okResponse.status, 200)
assert.equal(upstreamCalls.length, 1)
assert.equal(upstreamCalls[0].url, 'https://api.openai.com/v1/responses')
assert.equal(upstreamCalls[0].body.model, 'test-model')
assert.equal(upstreamCalls[0].body.metadata.source, 'concept-section')

const okPayload = await okResponse.json()
assert.equal(okPayload.answer, 'A dot product is alignment with length still attached.')
assert.equal(okPayload.nextAction, 'Predict the sign before dragging.')

const upstreamFailureResponse = await handleRequest(
  new Request('https://gateway.example.test/', {
    method: 'POST',
    headers: { origin: 'http://localhost:3003', 'content-type': 'application/json', 'cf-connecting-ip': '127.0.0.4' },
    body: JSON.stringify(companionRequest),
  }),
  env,
  {},
  async () => new Response(JSON.stringify({ error: { message: 'provider secret detail' } }), { status: 500 })
)
assert.equal(upstreamFailureResponse.status, 502)
assert.deepEqual(await upstreamFailureResponse.json(), { error: 'upstream_unavailable' })

console.log('[ai-gateway] contract tests passed')
