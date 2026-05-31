# Continuous Function

The premier one-stop mathematical atlas and research-learning environment for modern deep learning and frontier AI.

Continuous Function turns foundational math, model architectures, papers, equations, systems, and alignment ideas into connected, interactive learning paths.

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

# Build archival static export (out/)
npm run build:static

# Audit production dependencies
npm run audit:prod

# Serve the static export (out/)
python3 -m http.server --directory out 3000

# Validate filesystem content (content/)
npm run validate-content
```

## Tech Stack

- **Framework:** Next.js 15 (Pages Router today, Vercel full-stack platform path)
- **Language:** TypeScript (strict mode)
- **Visualizations:** D3.js, Three.js, GSAP
- **Math Rendering:** KaTeX via remark-math/rehype-katex
- **Testing:** Jest + React Testing Library
- **Platform Direction:** Vercel + Clerk + Neon/Postgres + Drizzle for logged-in learning, profiles, saved routes, object-attached research rooms, and collaboration

## Documentation

- [Developer Guide](DEVELOPER_GUIDE.md) - Architecture, patterns, and contribution guidelines
- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Production deployment instructions
- [Security Policy](SECURITY.md) - Reporting guidance and deployment/content safety notes
- [Product North Star](content/_agent/PRODUCT_NORTH_STAR.md) - Product identity, experience standard, and AI/research direction
- [Platform Foundation](content/_agent/PLATFORM_FOUNDATION.md) - Vercel/Clerk/Neon foundation for accounts, collaboration, and research objects
- [Content Strategy](CONTENT_STRATEGY.md) - Educational vision and roadmap
- [Contributing Guide](CONTRIBUTING.md) - How to propose content, code, and documentation changes
- [Code of Conduct](CODE_OF_CONDUCT.md) - Community expectations for collaboration

## Project Structure

```
pages/           # Next.js pages (concepts, pillars, index)
components/      # React components (visualizations, layout)
data/            # Content data (100 foundational concepts)
content/         # Filesystem-driven domains + concepts (source of truth long-term)
lib/             # Utilities (math objects, hooks)
gateway/         # Optional deployable services, including the AI companion gateway
styles/          # Global CSS
```

## License

MIT. See [LICENSE](LICENSE).
