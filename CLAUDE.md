# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Continuous Function" explores the mathematical foundations of deep learning through interactive visualizations. The site aims to connect concepts and build intuition by showing ideas from multiple angles—equations, code, geometry, and interactive demos. Built with Next.js + MDX, it features scroll-synced visualizations with D3 and KaTeX-rendered math.

### Tone and Philosophy

The site maintains a humble, exploratory tone—curious rather than authoritative. We're exploring these ideas and trying to connect them, not claiming to be experts or the definitive source. Avoid flowery language, superlatives, or comparisons to other educational platforms.

## Commands

- `npm run dev` - Start development server
- `npm run build` - Build static export (outputs to `out/`)
- `npm start` - Serve the production build

## Architecture

### Content Structure
- **MDX pages** in `pages/concepts/` contain mathematical explanations with embedded React components
- **Pillar pages** in `pages/pillars/` are standalone TSX pages for the five mathematical topic areas
- Math is rendered with KaTeX via remark-math/rehype-katex plugins configured in `next.config.mjs`

### Component Pattern
Interactive visualizations follow a consistent pattern:
- Use D3 for rendering within React components
- SVG-based charts with coordinate transforms (see `GradientDescentPlayground.tsx` for the pattern)
- Shared math types and utilities in `lib/mathObjects.ts` (Point2D, ScalarField2D, MATH_COLORS palette, numerical gradient computation)

### Layout
- `components/app/Layout.tsx` wraps all pages via `_app.tsx`
- Global styles in `styles/globals.css`
- Static export mode (`output: 'export'` in next.config.mjs)

### Key Visualization Components
- `GradientDescentPlayground` - Interactive 1D optimizer demo
- `MuonConceptualDemo` - Muon optimizer visualization
- `KnowledgeGraph` - D3 force-directed graph of concepts
- `PhasePortrait2D`, `TimeSeriesPlot`, `KernelHeatmap`, `StateTimeline` - Reusable visualization primitives

## Conventions

- Interactive components use inline sliders and controls, not modals
- Color palette defined in `lib/mathObjects.ts` as `MATH_COLORS`
- MDX files import and render React components inline with prose

## Content Strategy

See `CONTENT_STRATEGY.md` for the full educational vision and roadmap.

### Target Audience
ML practitioners who've outgrown tutorials but aren't PhD researchers—the "intermediate wasteland."

### Pedagogical Pattern
Every concept follows: **Intuition → Math → Code → Interactive demo**

### Five Core Pillars
1. **Sequence Modeling** - Attention, SSMs, Mamba
2. **Optimization** - Gradient descent as physics, Muon, Edge of Stability
3. **Generative Physics** - Diffusion, Flow Matching, Optimal Transport
4. **Geometric DL** - Symmetry, Equivariance, Manifolds
5. **Mechanistic Interpretability** - Reverse-engineering networks

### Priority Topics (Next to Build)
- Grouped Query Attention (GQA) with KV cache visualization
- RoPE geometric intuition with complex number animation
- SwiGLU activation comparison
- MoE routing visualization
- DPO vs RLHF comparison

---

## Oracle CLI Integration

Oracle CLI bundles prompts with files to query AI models for code review, analysis, and patch generation. It supports multiple providers and execution modes.

**Repository:** https://github.com/steipete/oracle

### Local Setup

```bash
npm install -g @steipete/oracle
```

Use browser mode for this repo through Oracle's documented manual-login flow:

```bash
./scripts/oracle/login.sh
./scripts/oracle/run.sh <slug> <prompt-file> <write-output> [--file <path> ...]
```

The persistent Oracle browser profile is `~/.oracle/browser-profile-continuous-function`. It must be logged into ChatGPT as `Archit Khare / adrinkscoffee@gmail.com`.

Do not use normal Chrome cookie-copy, `--remote-chrome`, or `scripts/oracle/start-chrome-profile.sh` unless the user explicitly asks.

See `ORACLE_GUIDE.md` for first-time login, config, dry-run, and recovery details.

### Session Management

Sessions stored in `~/.oracle/sessions/` (override with `ORACLE_HOME_DIR`).

```bash
oracle status --hours 72 --limit 50     # List recent sessions
oracle session <id>                     # Reattach to session
oracle session <id> --render            # Replay session output
oracle status --clear --hours 168       # Prune old sessions
tail -f ~/.oracle/sessions/<id>/output.log  # Live logs
```

### Extracting Patches

```bash
LOG=~/.oracle/sessions/<slug>/output.log
awk '/^\*\*\* Begin Patch/{f=1} f; /^\*\*\* End Patch/{print; f=0}' "$LOG" > patch.patch
# Or for git diffs:
awk '/^diff --git/{f=1} f' "$LOG" > changes.diff
```

### Environment Variables

- `OPENAI_API_KEY` - GPT models
- `GEMINI_API_KEY` - Gemini 3 Pro
- `ANTHROPIC_API_KEY` - Claude models
- `ORACLE_HOME_DIR` - Override session storage location
- `ORACLE_BROWSER_PROFILE_DIR` - Override Oracle's persistent browser profile only when the user explicitly changes the target session

### MCP Integration

Oracle provides an MCP (Model Context Protocol) server for IDE integration:

```bash
# Run as MCP stdio server
oracle-mcp
```

Configure in `.cursor/mcp.json` for Cursor IDE integration.

### AI Agent Best Practices

- Run `--dry-run summary` before large requests
- Save outputs with `--slug` and `--write-output responses/...`
- Reattach with `oracle session <slug> --render` instead of duplicating a stuck run
- Wait 15-60 minutes for large Pro browser responses
- Use unique session IDs; never reuse while a run is active
