# Continuous Function AI Companion Gateway

This is the deployable gateway for the AI companion. It keeps provider secrets outside the static Next.js export and gives the browser one safe endpoint to call through `NEXT_PUBLIC_CF_AI_GATEWAY_URL`.

The worker accepts the contract documented in `content/_agent/AI_COMPANION_GATEWAY_CONTRACT.md`, validates and trims the payload, rejects unapproved browser origins for POST, applies bounded JSON reads and a lightweight per-minute rate limit, calls the OpenAI Responses API from the server side, and returns the normalized shape the app already understands:

```json
{
  "answer": "A learner-facing answer.",
  "nextAction": "One thing to try on the page.",
  "followups": ["Optional follow-up prompt."]
}
```

## Files

- `worker.mjs` - Cloudflare Worker entrypoint.
- `wrangler.toml.example` - deployment config template.
- `sample-request.json` - local smoke-test payload.
- `test.mjs` - dependency-free contract tests.

## Verify Locally

```bash
npm run verify:ai-gateway
```

This does not call OpenAI. It uses a mocked fetch and checks contract validation, CORS, OpenAI request construction, and response normalization.

## Deploy With Cloudflare Workers

Copy the example config and set a real model:

```bash
cp gateway/ai-companion/wrangler.toml.example gateway/ai-companion/wrangler.toml
```

Set `OPENAI_MODEL` in `wrangler.toml`, then store the key as a Worker secret:

```bash
cd gateway/ai-companion
npx wrangler secret put OPENAI_API_KEY
npx wrangler deploy
```

After deployment, rebuild the static site with the public gateway URL:

```bash
NEXT_PUBLIC_CF_AI_GATEWAY_URL="https://your-worker.your-account.workers.dev/" npm run build
```

The public URL is not a secret, but it is still a spending endpoint. Do not deploy it publicly without Cloudflare WAF/rate limiting plus Turnstile, Access/JWT, or an equivalent signed-token gate. The provider API key must stay in Worker secrets.

## Required Environment

- `OPENAI_API_KEY` - Worker secret.
- `OPENAI_MODEL` - model name selected for the gateway.
- `ALLOWED_ORIGINS` - comma-separated browser origins. Default includes `continuousfunction.ai` and local dev on port `3003`.

Optional:

- `RATE_LIMIT_PER_MINUTE` - best-effort per-isolate limit, default `30`.
- `MAX_JSON_BODY_BYTES` - maximum request body before parsing, default `262144`.
- `MAX_PROMPT_CHARS` - default `12000`.
- `OPENAI_MAX_OUTPUT_TOKENS` - default `700`.
- `OPENAI_TEMPERATURE` - default `0.35`.
- `OPENAI_BASE_URL` - override only for compatible infrastructure.
- `TRUST_X_FORWARDED_FOR=1` - opt in only when the Worker is behind a trusted proxy that owns this header. By default rate-limit keys use `cf-connecting-ip` or fall back to `anonymous`.

## Security Notes

- Do not put `OPENAI_API_KEY` or provider secrets in `NEXT_PUBLIC_*` variables.
- Do not log full learner prompts by default; they may contain private study context.
- Keep CORS narrow. Production should include only the live domain and any preview domains you intentionally support.
- POST requests with no `Origin` header or an unapproved origin are rejected. The unauthenticated `GET` health check remains available.
- CORS is not authentication. Use Cloudflare WAF/rate limiting plus Turnstile, Access/JWT, or signed short-lived same-origin tokens before public deployment.
- The in-worker counter is only a local fallback. Add Durable Object/KV-backed global limits before treating this as production abuse protection.
