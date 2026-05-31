# Continuous Function Paper Mapper Gateway

This worker is the server-side ingestion layer for `/paper-map`.

It keeps the static site honest:

- parse arXiv IDs from pasted links or notes;
- fetch arXiv Atom metadata server-side;
- fetch allowed remote PDF URLs or accept uploaded PDF bytes as base64;
- recover selectable PDF text from page content streams, including common `Tj`, `TJ`, quote, literal-string, and hex-string text operators;
- normalize recovered text into page-bounded spans and return parser-quality metadata;
- extract equation-like snippets with page/line spans from source text and metadata;
- promote recovered equations into first-class equation objects with source boxes, explainer prompts, and graph attachments;
- build a source-grounded concept mapping packet;
- optionally call the OpenAI Responses API when `OPENAI_API_KEY` and `OPENAI_MODEL` are configured;
- return citations, confidence labels, and warnings instead of pretending unsupported claims are verified.

## Contract

Request:

```json
{
  "version": "continuous-function.paper-mapper.v1",
  "source": {
    "raw": "https://arxiv.org/pdf/2405.12345",
    "kind": "pdf",
    "pdfUrl": "https://arxiv.org/pdf/2405.12345"
  },
  "hints": {
    "matchedTerms": ["kv", "cache", "serving"]
  }
}
```

Response shape:

```json
{
  "version": "continuous-function.paper-mapper.v1",
  "source": { "kind": "pdf", "arxivId": "2405.12345", "pdfUrl": "https://arxiv.org/pdf/2405.12345" },
  "metadata": { "title": "...", "authors": ["..."], "url": "..." },
  "extracted": {
    "pdf": {
      "status": "parsed",
      "source": "remote_url",
      "url": "https://arxiv.org/pdf/2405.12345",
      "byteLength": 420000,
      "textChars": 12000,
      "pages": [{ "page": 1, "lineCount": 84, "charCount": 3200 }],
      "blocks": [
        {
          "page": 1,
          "line": 12,
          "text": "KV memory = 2 * L * H_kv * d_head * bytes",
          "bbox": { "x": 72, "y": 680, "width": 230, "height": 14 }
        }
      ],
      "equationBlocks": [
        {
          "id": "pdf-eq-1-12",
          "page": 1,
          "text": "KV memory = 2 * L * H_kv * d_head * bytes",
          "bbox": { "x": 72, "y": 680, "width": 230, "height": 14 },
          "lineStart": 12,
          "lineEnd": 12,
          "confidence": "high"
        }
      ],
      "quality": {
        "confidence": "high",
        "decodedStreamCount": 14,
        "textStreamCount": 12,
        "fallbackStreamCount": 0,
        "lineCount": 220,
        "operators": ["TJ", "Tj", "Td", "Tm"]
      },
      "ocr": { "status": "not_needed", "pageCount": 0 },
      "warnings": []
    },
    "equationCandidates": ["KV memory = 2 * L * H_kv * d_head * bytes"],
    "equationSpans": [
      {
        "id": "eq-2",
        "equation": "KV memory = 2 * L * H_kv * d_head * bytes",
        "sourceId": "page-3",
        "page": 3,
        "lineStart": 2,
        "lineEnd": 2
      }
    ],
    "equationObjects": [
      {
        "id": "eqobj-pdf-eq-1-12-1",
        "label": "Page 1, line 12",
        "equation": "KV memory = 2 * L * H_kv * d_head * bytes",
        "confidence": "high",
        "source": {
          "kind": "pdf",
          "sourceId": "pdf-eq-1-12",
          "page": 1,
          "lineStart": 12,
          "lineEnd": 12,
          "bbox": { "x": 72, "y": 680, "width": 230, "height": 14 }
        },
        "prompt": "Explain this equation from the paper step by step...",
        "graphAttachment": {
          "type": "equation",
          "conceptIds": ["efficient-attention", "llm-serving"],
          "paper": "Paper title or source",
          "route": ["Efficient Attention", "LLM Serving"]
        }
      }
    ],
    "sourceSpans": [
      {
        "id": "span-3",
        "label": "Page 3, line 3",
        "quote": "We reduce KV cache memory for long-context LLM serving...",
        "page": 3,
        "lineStart": 3,
        "lineEnd": 3
      }
    ],
    "matchedTerms": []
  },
  "mapping": { "summary": "...", "confidence": "high", "concepts": [] },
  "ai": "optional JSON text from the server-side mapper",
  "warnings": []
}
```

For browser uploads, send:

```json
{
  "source": {
    "raw": "paper.pdf",
    "kind": "pdf",
    "filename": "paper.pdf",
    "mimeType": "application/pdf",
    "pdfBase64": "JVBERi0xLjQK..."
  }
}
```

Remote PDF fetching is host-allowlisted to reduce SSRF risk. By default the worker allows `arxiv.org` and `www.arxiv.org`; set `PDF_ALLOWED_HOSTS` as a comma-separated list to permit other scholarly hosts. `MAX_PDF_BYTES` defaults to 6 MB.

Remote PDF responses must stay on allowlisted HTTPS hosts across redirects, advertise an allowed PDF content type, and stream under the byte cap. `PDF_FETCH_TIMEOUT_MS` defaults to 10000, and `PDF_MAX_REDIRECTS` defaults to 2.

JSON request bodies are capped before parsing. The default body cap is derived from `MAX_PDF_BYTES` so base64 uploads still fit; set `MAX_JSON_BODY_BYTES` to make this stricter for deployments that disable inline PDF uploads.

Parser limits: this is a Worker-safe selectable-text parser, not a full PDF layout engine. It reports `quality.confidence`, recovered operator coverage, fallback usage, approximate bounding boxes, and warnings when text may be approximate, font-encoded, scanned, encrypted, or image-only. Downstream AI should treat low-confidence PDF extraction as a prompt to ask for a cleaner PDF or human-selected excerpt.

OCR fallback is opt-in. If `PDF_OCR_ENDPOINT` is configured and selectable text is missing, the worker POSTs `{ fileName, mimeType, pdfBase64, maxPages }` to that endpoint, optionally with `PDF_OCR_API_KEY` as a bearer token. The endpoint must use HTTPS and its hostname must appear in `PDF_OCR_ALLOWED_HOSTS`; otherwise OCR is skipped. Because this transmits uploaded PDFs to another service, only configure an OCR endpoint you control and disclose that behavior in the product UI.

## Verify Locally

```bash
npm run verify:paper-gateway
```

The test uses a mocked arXiv response and does not call OpenAI.

## Deploy

```bash
cp gateway/paper-mapper/wrangler.toml.example gateway/paper-mapper/wrangler.toml
cd gateway/paper-mapper
npx wrangler secret put OPENAI_API_KEY
npx wrangler deploy
```

Then build the static app with:

```bash
NEXT_PUBLIC_CF_PAPER_MAPPER_GATEWAY_URL="https://your-paper-mapper.your-account.workers.dev/" npm run build
```

The public gateway URL is not a secret, but it is still a spending and PDF-processing endpoint. Do not deploy it publicly without Cloudflare WAF/rate limiting plus Turnstile, Access/JWT, or an equivalent signed-token gate. Provider secrets stay inside the worker.

## Security Notes

- POST requests with no `Origin` header or an unapproved origin are rejected. The unauthenticated `GET` health check remains available.
- CORS is not authentication; it only limits browser calls from unapproved origins.
- The in-worker rate-limit counter is best-effort per isolate. Add Durable Object/KV-backed global limits before production use.
- By default rate-limit keys use `cf-connecting-ip`; set `TRUST_X_FORWARDED_FOR=1` only behind a trusted proxy that owns that header.
- Keep `PDF_ALLOWED_HOSTS` narrow, ideally arXiv-only, and keep OCR disabled unless the product UI clearly discloses the third-party processing path.
