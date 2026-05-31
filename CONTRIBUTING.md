# Contributing to Continuous Function

Thanks for contributing.

## Before You Start

- Read [README.md](README.md) for setup and project structure.
- Read [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for architecture and implementation patterns.
- Read [CONTENT_STRATEGY.md](CONTENT_STRATEGY.md) before proposing large content or pedagogy changes.

## Development Setup

```bash
npm install
npm run dev
```

Recommended verification commands:

```bash
npm run validate-content
npm run typecheck
npm test
npm run build
```

## Content Contributions

This project teaches ideas using the sequence:

**Intuition → Math → Code → Interactive Demo**

When adding or revising concepts:

- Keep explanations concrete and curious, not overly authoritative.
- Define symbols before using them.
- Keep code examples short, runnable, and aligned with the math.
- Prefer interactive visualizations that directly teach the core intuition.

Filesystem-driven concept content lives under `content/domains/**`.

## Code Contributions

- Prefer focused pull requests.
- Preserve the existing visual language unless the change is intentionally expanding it.
- Keep accessibility in mind for all interactive components.
- Clean up event listeners, animation frames, and other client-side resources.

## Pull Requests

Please include:

- what changed
- why it changed
- how you validated it
- screenshots or screen recordings for UI or visualization changes

If your change touches pedagogy, explain the learning outcome you were trying to improve.

## Security

Do not commit secrets, API keys, or private deployment credentials.

For vulnerability reports, follow [SECURITY.md](SECURITY.md).
