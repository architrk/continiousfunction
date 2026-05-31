# AI Companion Gateway Contract

Created: 2026-05-02

Continuous Function is statically exported, so the browser must never hold model provider secrets. The site can call a companion only through a separately deployed gateway.

## Client Configuration

Set this public variable at build time when a gateway exists:

```bash
NEXT_PUBLIC_CF_AI_GATEWAY_URL="https://your-gateway.example.com/api/companion"
```

If the variable is absent, the UI stays in offline prompt-copy mode.

The deployable Worker scaffold lives in `gateway/ai-companion/`.

```bash
npm run verify:ai-gateway
cp gateway/ai-companion/wrangler.toml.example gateway/ai-companion/wrangler.toml
cd gateway/ai-companion
npx wrangler secret put OPENAI_API_KEY
npx wrangler deploy
```

After deployment, rebuild the static export with the Worker URL in `NEXT_PUBLIC_CF_AI_GATEWAY_URL`.

## Gateway Responsibility

The gateway owns:

- model provider API keys
- model choice and fallback models
- rate limits and abuse controls
- request logging policy
- CORS allowlist for the production domain and local development
- conversion from the site request shape to the provider API

The browser owns:

- page context
- learner-entered question text
- section snippets and selected text
- graceful fallback when the gateway is unavailable

## Request

The browser sends `POST` JSON:

```json
{
  "version": "continuous-function.ai-companion.v1",
  "source": "concept-section",
  "mode": "concept",
  "prompt": "You are my AI learning companion...",
  "task": {
    "id": "explain",
    "label": "Explain",
    "instruction": "Explain this section in plain language first..."
  },
  "context": {
    "domainTitle": "Linear Algebra",
    "surfaceTitle": "Dot Product",
    "description": "The dot product measures alignment...",
    "currentSection": "Intuition",
    "sectionStep": "01",
    "sectionSummary": "Start with the picture...",
    "sectionSnippet": "The dot product answers the question...",
    "prerequisites": ["Vector Spaces"],
    "nextConcept": "Norms",
    "nextStep": "Manipulate one control and predict the visible change."
  },
  "learner": {
    "question": "Why does this become cosine similarity?",
    "goal": "Understand the idea",
    "comfortLevel": "Somewhat familiar",
    "explanationStyle": "Visual first",
    "stuckReason": "Equation jump"
  },
  "safety": {
    "audience": "stem-learner",
    "style": [
      "Use intuition before notation.",
      "Define symbols before using them."
    ],
    "boundaries": [
      "Do not invent prerequisites or graph links.",
      "Do not request secrets, private keys, passwords, or payment data."
    ]
  }
}
```

## Response

Return either plain text or JSON:

```json
{
  "answer": "Short learner-facing answer...",
  "followups": ["Try changing the angle in the demo."],
  "nextAction": "Predict the sign of the dot product before dragging the vector."
}
```

The UI reads `answer`, optionally appends `nextAction`, and falls back to copying the prompt if the request fails.

## Safety Notes

- Do not expose provider keys through `NEXT_PUBLIC_*`.
- Do not let the model invent page graph structure; use the supplied context.
- Do not require login for basic page reading.
- Treat learner text as private user content in gateway logs.
- Keep answers compact enough to sit beside the notebook instead of replacing it.
