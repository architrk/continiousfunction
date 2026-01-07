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
- `components/Layout.tsx` wraps all pages via `_app.tsx`
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

### Supported Models

- **GPT-5.1 Pro** (default), GPT-5.1 Codex, GPT-5.1
- **Gemini 3 Pro**
- **Claude Sonnet 4.5**, Claude Opus 4.1
- **OpenRouter** models

### Execution Modes

| Mode | Description |
|------|-------------|
| **API** | Direct API calls (requires API keys) |
| **Browser** | Automates ChatGPT via Chromium (no API key needed) |
| **Manual** | Generates bundles for manual pasting (`--render --copy`) |
| **TUI** | Interactive terminal mode (`oracle tui`) |

### Installation

```bash
npm install -g @steipete/oracle
# Or use npx (prefer over pnpx due to sqlite binding issues):
npx -y @steipete/oracle [options]
```

### Essential CLI Flags

| Flag | Purpose |
|------|---------|
| `-p, --prompt` | User query (required) |
| `-f, --file` | File paths with glob support |
| `-e, --engine` | `api` or `browser` |
| `-m, --model` | Single model selection |
| `--models` | Comma-separated for multi-model runs |
| `--wait` | Block until completion |
| `--dry-run` | Preview bundle (`summary`, `json`, `full`) |
| `--files-report` | Show per-file token usage |
| `--render` | Display assembled bundle |
| `--copy` | Copy bundle to clipboard |
| `--write-output` | Write response to file |

### Usage Examples

```bash
# API mode with file context
npx -y @steipete/oracle -p "Review this code" --file src/*.ts

# Browser automation (no API key needed)
npx -y @steipete/oracle --engine browser -p "Analyze architecture" \
  --file "src/**/*.ts" --wait

# Multi-model comparison
npx -y @steipete/oracle -p "Review implementation" \
  --models gpt-5.1-pro,gemini-3-pro,claude-sonnet-4.5 \
  --file "src/**/*.ts" --wait

# Preview without spending tokens
npx -y @steipete/oracle --dry-run summary -p "Question" --file docs/*.md

# Manual mode for ChatGPT pasting
npx -y @steipete/oracle --render --copy -p "Explain this" --file src/main.ts
```

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

### Configuration

Create `~/.oracle/config.json` (JSON5 format):
```json5
{
  model: "gpt-5.1-pro",
  engine: "api",
  filesReport: true,
  notify: true,
  browser: {
    chatgptUrl: "https://chatgpt.com/your-workspace-url",
    inputTimeout: "180s",
    timeout: "30m"
  }
}
```

### Environment Variables

- `OPENAI_API_KEY` - GPT models
- `GEMINI_API_KEY` - Gemini 3 Pro
- `ANTHROPIC_API_KEY` - Claude models
- `ORACLE_HOME_DIR` - Override session storage location

### MCP Integration

Oracle provides an MCP (Model Context Protocol) server for IDE integration:

```bash
# Run as MCP stdio server
oracle-mcp
```

Configure in `.cursor/mcp.json` for Cursor IDE integration.

### Advanced Features

- **Extended Thinking Mode (GPT-5.2 Pro):** Use `--browser-extended-thinking` to enable longer reasoning time for complex questions. Requires local fork until next npm release.
- **Remote Browser Service:** Run `oracle serve` on a signed-in host, connect via `--remote-host` and `--remote-token`
- **Azure OpenAI:** Use `--azure-endpoint`, `--azure-deployment`, `--azure-api-version`
- **Multi-model aggregation:** Combines responses with aggregated cost tracking

### Extended Thinking (GPT-5.2 Pro)

For complex reasoning tasks, enable extended thinking mode:

```bash
oracle --engine browser \
  --browser-extended-thinking \
  --browser-chrome-profile "Profile 1" \
  --browser-port 9888 \
  --browser-timeout 60m \
  -m "gpt-5.2-pro" \
  --wait \
  -p "Your complex reasoning prompt"
```

**Note:** This feature requires installing Oracle from the local fork at `~/Desktop/oracle-fork` until the next npm release:
```bash
cd ~/Desktop/oracle-fork && npm link
```

### Platform Support

| Platform | Status |
|----------|--------|
| macOS | Stable |
| Linux | Functional (may need `--browser-chrome-path`, `--browser-cookie-path`) |
| Windows | Supported (manual login or inline cookies recommended) |

### AI Agent Best Practices

- Run Oracle in background (`run_in_background: true`)
- Check output every 2-3 minutes
- Wait 15-20 minutes for GPT-5 Pro responses
- Use unique session IDs; never reuse while a run is active
- Prefer `--dry-run summary` to preview token usage before expensive runs
