# Continuous Function

Interactive explorations of the mathematical foundations of deep learning.

- Legacy curriculum: 100 foundational concepts (data-driven, `/foundations/*`)
- New system: filesystem-driven domains + concepts (infinite, `/domains/*`)

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Typecheck + lint + tests
npm run typecheck
npm run lint
npm test

# Build for production
npm run build

# Serve the static export (out/)
python3 -m http.server --directory out 3000

# Validate filesystem content (content/)
npm run validate-content
```

## Tech Stack

- **Framework:** Next.js 15 (Pages Router, static export)
- **Language:** TypeScript (strict mode)
- **Visualizations:** D3.js, Three.js, GSAP
- **Math Rendering:** KaTeX via remark-math/rehype-katex
- **Testing:** Jest + React Testing Library

## Documentation

- [Developer Guide](DEVELOPER_GUIDE.md) - Architecture, patterns, and contribution guidelines
- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Production deployment instructions
- [Content Strategy](CONTENT_STRATEGY.md) - Educational vision and roadmap
- [Claude Instructions](CLAUDE.md) - AI assistant context for this codebase

## Project Structure

```
pages/           # Next.js pages (concepts, pillars, index)
components/      # React components (visualizations, layout)
data/            # Content data (100 foundational concepts)
content/         # Filesystem-driven domains + concepts (source of truth long-term)
lib/             # Utilities (math objects, hooks)
styles/          # Global CSS
```

## License

No license file is currently committed. Add a `LICENSE` file (or update this section) before treating this as open source.
