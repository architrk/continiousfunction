import assert from 'node:assert/strict'
import {
  buildEvidenceMapping,
  buildOpenAIMapperRequest,
  extractEquationSpans,
  extractPdfTextFromBytes,
  extractSourceSpans,
  fetchArxivMetadata,
  handlePaperMapperRequest,
  validatePaperMapperRequest,
} from './worker.mjs'

const requestBody = {
  version: 'continuous-function.paper-mapper.v1',
  source: {
    raw: [
      'https://arxiv.org/abs/2405.12345 KV cache compression for long-context LLM serving',
      '[page 3] KV memory = 2 * L * H_kv * d_head * bytes',
      '[page 3] We reduce KV cache memory for long-context LLM serving by sharing or compressing value states.',
    ].join('\n'),
    kind: 'arxiv',
  },
  hints: {
    matchedTerms: ['kv', 'cache', 'serving'],
  },
}

const env = {
  ALLOWED_ORIGINS: 'http://127.0.0.1:3005',
  RATE_LIMIT_PER_MINUTE: '100',
  OPENAI_MODEL: 'test-model',
}

const sanitized = validatePaperMapperRequest(requestBody, env)
assert.equal(sanitized.version, 'continuous-function.paper-mapper.v1')
assert.equal(sanitized.source.kind, 'arxiv')
assert.equal(sanitized.source.arxivId, '2405.12345')

const localEquationSpans = extractEquationSpans(sanitized.source.raw)
assert.equal(localEquationSpans[0].page, 3)
assert.equal(localEquationSpans[0].lineStart, 2)
assert.match(localEquationSpans[0].equation, /KV memory/)

const localSourceSpans = extractSourceSpans(sanitized.source.raw)
const pageSourceSpan = localSourceSpans.find((span) => span.page === 3)
assert.equal(pageSourceSpan?.page, 3)
assert.equal(pageSourceSpan?.lineStart, 3)
assert.match(pageSourceSpan?.quote ?? '', /long-context LLM serving/)

const samplePdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 220 >>
stream
BT
/F1 12 Tf
72 720 Td
(KV memory = 2 * L * H_kv * d_head * bytes) Tj
T*
(We reduce KV cache memory for long-context LLM serving by sharing value states.) Tj
1 0 0 1 72 680 Tm
[(Flash) -180 (Attention) 220 (keeps exact attention while changing memory movement.)] TJ
T*
<4b4c206f626a656374697665203d206c6f6720705f7468657461> Tj
ET
endstream
endobj
trailer << /Root 1 0 R >>
%%EOF`

const pdfBytes = new TextEncoder().encode(samplePdf)
const pdfText = await extractPdfTextFromBytes(pdfBytes, 'kv-cache.pdf')
assert.equal(pdfText.pages[0].page, 1)
assert.match(pdfText.text, /\[page 1\] KV memory/)
assert.match(pdfText.text, /\[page 1\] We reduce KV cache memory/)
assert.match(pdfText.text, /Flash Attention keeps exact attention/)
assert.match(pdfText.text, /KL objective = log p_theta/)
assert.equal(pdfText.quality.confidence, 'high')
assert.ok(pdfText.quality.operators.includes('TJ'))
assert.ok(pdfText.blocks.some((block) => block.page === 1 && block.bbox.width > 0))
assert.ok(pdfText.equationBlocks.some((block) => /KV memory/.test(block.text) && block.bbox.width > 0))

const atom = `<?xml version="1.0"?>
<feed>
  <entry>
    <id>http://arxiv.org/abs/2405.12345v1</id>
    <updated>2026-05-01T00:00:00Z</updated>
    <published>2026-05-01T00:00:00Z</published>
    <title>Compressing the KV Cache for Long Context Serving</title>
    <summary>We reduce KV cache memory for efficient LLM serving while preserving attention quality.</summary>
    <author><name>Ada Researcher</name></author>
    <author><name>Grace Engineer</name></author>
  </entry>
</feed>`

const fetchCalls = []
const mockFetch = async (url) => {
  fetchCalls.push(url)
  return new Response(atom, { status: 200, headers: { 'content-type': 'application/atom+xml' } })
}

const metadata = await fetchArxivMetadata('2405.12345', mockFetch)
assert.equal(metadata.title, 'Compressing the KV Cache for Long Context Serving')
assert.deepEqual(metadata.authors, ['Ada Researcher', 'Grace Engineer'])
assert.equal(fetchCalls[0], 'https://export.arxiv.org/api/query?id_list=2405.12345')

const mapping = buildEvidenceMapping(sanitized, metadata)
assert.equal(mapping.confidence, 'high')
assert.ok(mapping.concepts.some((concept) => concept.id === 'efficient-attention'))
assert.ok(mapping.concepts.some((concept) => concept.id === 'llm-serving'))

const openAIRequest = buildOpenAIMapperRequest(sanitized, metadata, mapping, env)
assert.equal(openAIRequest.model, 'test-model')
assert.equal(openAIRequest.store, false)
assert.equal(openAIRequest.metadata.source, 'paper-mapper')
assert.match(openAIRequest.input, /Compressing the KV Cache/)
assert.match(openAIRequest.input, /lineStart/)

const response = await handlePaperMapperRequest(
  new Request('https://paper-gateway.example.test/', {
    method: 'POST',
    headers: { origin: 'http://127.0.0.1:3005', 'content-type': 'application/json', 'cf-connecting-ip': '127.0.0.1' },
    body: JSON.stringify(requestBody),
  }),
  env,
  mockFetch
)

assert.equal(response.status, 200)
assert.equal(response.headers.get('access-control-allow-origin'), 'http://127.0.0.1:3005')

const payload = await response.json()
assert.equal(payload.version, 'continuous-function.paper-mapper.v1')
assert.equal(payload.metadata.title, 'Compressing the KV Cache for Long Context Serving')
assert.equal(payload.mapping.confidence, 'high')
assert.equal(payload.extracted.equationSpans[0].page, 3)
assert.equal(payload.extracted.equationSpans[0].lineStart, 2)
assert.match(payload.extracted.equationCandidates[0], /KV memory/)
assert.match(payload.extracted.equationObjects[0].equation, /KV memory/)
assert.equal(payload.extracted.equationObjects[0].source.kind, 'pasted-text')
assert.equal(payload.extracted.equationObjects[0].source.page, 3)
assert.match(payload.extracted.equationObjects[0].prompt, /Define every symbol/)
assert.ok(payload.extracted.equationObjects[0].graphAttachment.conceptIds.includes('efficient-attention'))
assert.ok(payload.extracted.sourceSpans.some((span) => span.id === 'arxiv-abstract'))
assert.equal(payload.warnings.length, 1)
assert.match(payload.warnings[0], /AI mapping was skipped/)

const missingOriginResponse = await handlePaperMapperRequest(
  new Request('https://paper-gateway.example.test/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(requestBody),
  }),
  env,
  mockFetch
)
assert.equal(missingOriginResponse.status, 403)

const unsupportedTypeResponse = await handlePaperMapperRequest(
  new Request('https://paper-gateway.example.test/', {
    method: 'POST',
    headers: { origin: 'http://127.0.0.1:3005', 'content-type': 'text/plain', 'cf-connecting-ip': '127.0.0.11' },
    body: JSON.stringify(requestBody),
  }),
  env,
  mockFetch
)
assert.equal(unsupportedTypeResponse.status, 415)
assert.equal((await unsupportedTypeResponse.json()).error, 'unsupported_content_type')

const oversizedBodyResponse = await handlePaperMapperRequest(
  new Request('https://paper-gateway.example.test/', {
    method: 'POST',
    headers: { origin: 'http://127.0.0.1:3005', 'content-type': 'application/json', 'cf-connecting-ip': '127.0.0.12' },
    body: JSON.stringify(requestBody),
  }),
  { ...env, MAX_JSON_BODY_BYTES: '64' },
  mockFetch
)
assert.equal(oversizedBodyResponse.status, 413)
assert.equal((await oversizedBodyResponse.json()).error, 'request_too_large')

const pdfResponse = await handlePaperMapperRequest(
  new Request('https://paper-gateway.example.test/', {
    method: 'POST',
    headers: { origin: 'http://127.0.0.1:3005', 'content-type': 'application/json', 'cf-connecting-ip': '127.0.0.2' },
    body: JSON.stringify({
      version: 'continuous-function.paper-mapper.v1',
      source: {
        raw: 'kv-cache.pdf',
        kind: 'pdf',
        filename: 'kv-cache.pdf',
        mimeType: 'application/pdf',
        pdfBase64: Buffer.from(pdfBytes).toString('base64'),
      },
      hints: {
        matchedTerms: ['kv', 'cache', 'long context'],
      },
    }),
  }),
  env,
  mockFetch
)

assert.equal(pdfResponse.status, 200)
const pdfPayload = await pdfResponse.json()
assert.equal(pdfPayload.source.kind, 'pdf')
assert.equal(pdfPayload.extracted.pdf.status, 'parsed')
assert.equal(pdfPayload.extracted.pdf.source, 'inline_base64')
assert.equal(pdfPayload.extracted.pdf.pages[0].page, 1)
assert.ok(pdfPayload.extracted.pdf.blocks.some((block) => block.page === 1 && block.bbox.width > 0))
assert.ok(pdfPayload.extracted.pdf.equationBlocks.some((block) => /KL objective/.test(block.text)))
assert.equal(pdfPayload.extracted.pdf.ocr.status, 'not_needed')
assert.match(pdfPayload.extracted.equationCandidates[0], /KV memory/)
assert.ok(pdfPayload.extracted.equationCandidates.some((candidate) => /KL objective/.test(candidate)))
const kvEquationObject = pdfPayload.extracted.equationObjects.find((object) => /KV memory/.test(object.equation))
assert.ok(kvEquationObject)
assert.equal(kvEquationObject.source.kind, 'pdf')
assert.equal(kvEquationObject.source.page, 1)
assert.ok(kvEquationObject.source.bbox.width > 0)
assert.ok(kvEquationObject.graphAttachment.conceptIds.includes('efficient-attention'))
assert.match(kvEquationObject.prompt, /concept route/)
assert.ok(pdfPayload.extracted.sourceSpans.some((span) => span.page === 1 && /long-context/.test(span.quote)))
assert.equal(pdfPayload.extracted.pdf.quality.confidence, 'high')
assert.ok(pdfPayload.mapping.concepts.some((concept) => concept.id === 'efficient-attention'))

const remoteFetchCalls = []
const remotePdfFetch = async (url, options = {}) => {
  remoteFetchCalls.push({ url, options })
  if (String(url).startsWith('https://export.arxiv.org/')) {
    return new Response(atom, { status: 200, headers: { 'content-type': 'application/atom+xml' } })
  }
  return new Response(pdfBytes, {
    status: 200,
    headers: { 'content-type': 'application/pdf', 'content-length': String(pdfBytes.length) },
  })
}

const remotePdfResponse = await handlePaperMapperRequest(
  new Request('https://paper-gateway.example.test/', {
    method: 'POST',
    headers: { origin: 'http://127.0.0.1:3005', 'content-type': 'application/json', 'cf-connecting-ip': '127.0.0.13' },
    body: JSON.stringify({
      version: 'continuous-function.paper-mapper.v1',
      source: {
        raw: 'https://arxiv.org/pdf/2405.12345',
        kind: 'pdf',
      },
      hints: {
        matchedTerms: ['kv', 'cache'],
      },
    }),
  }),
  env,
  remotePdfFetch
)

assert.equal(remotePdfResponse.status, 200)
assert.ok(remoteFetchCalls.some((call) => call.url === 'https://arxiv.org/pdf/2405.12345' && call.options.redirect === 'manual'))
const remotePdfPayload = await remotePdfResponse.json()
assert.equal(remotePdfPayload.extracted.pdf.source, 'remote_url')
assert.equal(remotePdfPayload.extracted.pdf.status, 'parsed')

const redirectResponse = await handlePaperMapperRequest(
  new Request('https://paper-gateway.example.test/', {
    method: 'POST',
    headers: { origin: 'http://127.0.0.1:3005', 'content-type': 'application/json', 'cf-connecting-ip': '127.0.0.14' },
    body: JSON.stringify({
      version: 'continuous-function.paper-mapper.v1',
      source: {
        raw: 'https://arxiv.org/pdf/2405.12345',
        kind: 'pdf',
      },
      hints: {
        matchedTerms: ['kv', 'cache'],
      },
    }),
  }),
  env,
  async (url) => {
    if (String(url).startsWith('https://export.arxiv.org/')) {
      return new Response(atom, { status: 200, headers: { 'content-type': 'application/atom+xml' } })
    }
    return new Response(null, { status: 302, headers: { location: 'https://evil.example/file.pdf' } })
  }
)

assert.equal(redirectResponse.status, 400)
assert.equal((await redirectResponse.json()).error, 'invalid_pdf_url')

const scannedPdf = new TextEncoder().encode(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /XObject << /Im1 4 0 R >> >> >>
endobj
4 0 obj
<< /Subtype /Image /Width 10 /Height 10 /Length 4 >>
stream
xxxx
endstream
endobj
%%EOF`)

const ocrCalls = []
const ocrFetch = async (url, options) => {
  ocrCalls.push({ url, body: JSON.parse(options.body) })
  return new Response(
    JSON.stringify({
      pages: [
        {
          page: 1,
          lines: ['KV memory = 2 * L * H_kv * d_head * bytes', 'OCR recovered a scanned long-context serving paper.'],
        },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  )
}

const ocrResponse = await handlePaperMapperRequest(
  new Request('https://paper-gateway.example.test/', {
    method: 'POST',
    headers: { origin: 'http://127.0.0.1:3005', 'content-type': 'application/json', 'cf-connecting-ip': '127.0.0.3' },
    body: JSON.stringify({
      version: 'continuous-function.paper-mapper.v1',
      source: {
        raw: 'scanned.pdf',
        kind: 'pdf',
        filename: 'scanned.pdf',
        mimeType: 'application/pdf',
        pdfBase64: Buffer.from(scannedPdf).toString('base64'),
      },
      hints: {
        matchedTerms: ['kv', 'cache'],
      },
    }),
  }),
  { ...env, PDF_OCR_ENDPOINT: 'https://ocr.example.test/extract', PDF_OCR_ALLOWED_HOSTS: 'ocr.example.test' },
  ocrFetch
)

assert.equal(ocrResponse.status, 200)
const ocrPayload = await ocrResponse.json()
assert.equal(ocrCalls[0].url, 'https://ocr.example.test/extract')
assert.equal(ocrCalls[0].body.fileName, 'scanned.pdf')
assert.equal(ocrPayload.extracted.pdf.ocr.status, 'parsed')
assert.equal(ocrPayload.extracted.pdf.quality.needsOcr, true)
assert.match(ocrPayload.extracted.equationCandidates[0], /KV memory/)
assert.match(ocrPayload.extracted.equationObjects[0].equation, /KV memory/)
assert.equal(ocrPayload.extracted.equationObjects[0].source.kind, 'pdf')
assert.equal(ocrPayload.extracted.equationObjects[0].source.page, 1)
assert.equal(ocrPayload.extracted.equationObjects[0].source.bbox, undefined)

console.log('[paper-mapper-gateway] contract tests passed')
