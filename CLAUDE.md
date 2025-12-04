# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Continuous Function" is an interactive educational site explaining the mathematical foundations of deep learning through explorable explanations. Built with Next.js + MDX, it features scroll-synced visualizations with D3 and KaTeX-rendered math.

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

---

## Oracle CLI Integration

This repository uses the Oracle CLI (GPT-5.1 Pro) in Browser mode for code review and patch generation.

### Pre-flight Checks for AI Agents

Before running any Oracle command:
1. Check version: `oracle --version` (if < 1.3.0, don't use `--notify`/`--notify-sound`; if 1.2.x use `--model "gpt-5-pro"`)
2. Oracle uses a **temporary Chrome profile** per run - this is separate from the user's regular browser
3. GPT-5 Pro takes 10-20 minutes for complex prompts; "prompt did not appear" errors often mean the prompt was sent but Oracle timed out

### Installation

```bash
npm install -g @steipete/oracle
# Or: npx @steipete/oracle [options]
```

### Browser Flow Defaults

```bash
oracle --engine browser --model "gpt-5.1-pro" --slug <slug> \
  --browser-input-timeout 180s --browser-timeout 30m --wait \
  --files-report --browser-inline-files \
  --notify --notify-sound \
  --file <path> --prompt "<prompt>"
```

- Use short kebab-case slugs (e.g., `parts-editor-fix`)
- Prefer `--browser-inline-files`; fall back to `--browser-bundle-files` for large payloads
- Always pass `--files-report` on first run

### Session Management

```bash
oracle status --hours 72 --limit 50     # List recent sessions
oracle session <slug>                   # Reattach to session
oracle session <slug> --render          # Replay session output
tail -f ~/.oracle/sessions/<slug>/output.log  # Live logs
```

### Extracting Patches

```bash
LOG=~/.oracle/sessions/<slug>/output.log
awk '/^\*\*\* Begin Patch/{f=1} f; /^\*\*\* End Patch/{print; f=0}' "$LOG" > patches/<slug>.patch
# Or for git diffs:
awk '/^diff --git/{f=1} f' "$LOG" > patches/<slug>.diff
```

### Timeout Recovery

When Oracle times out during GPT-5 Pro runs:
1. Check `~/.oracle/sessions/<slug>/output.log` for partial responses
2. Do NOT immediately retry - verify no response was captured first
3. Retry with longer timeout: `--browser-input-timeout 300s --browser-timeout 45m`

### AI Agent Best Practices

- Run Oracle in background (`run_in_background: true`)
- Check output every 2-3 minutes with `BashOutput`
- Wait 15-20 minutes for GPT-5 Pro responses
- Use unique slugs; never reuse a slug while a run is active

### Parallel Runs

```bash
for slug in auth-plan ui-polish storage-migration; do
  oracle --engine browser --model "gpt-5.1-pro" --slug $slug \
    --files-report --browser-bundle-files \
    --browser-input-timeout 180s --browser-timeout 30m \
    --notify --prompt "$(cat prompts/${slug}.txt)" &
done
wait
oracle status --hours 6 --limit 50
```

### Multi-Model Runs

```bash
oracle --prompt "Analyze architecture" \
  --models gpt-5.1-pro,gemini-3-pro,claude-4.5-sonnet \
  --file "src/**/*.ts" --wait
```

### Configuration

Create `~/.oracle/config.json` for persistent defaults:
```json5
{
  model: "gpt-5.1-pro",
  engine: "browser",
  filesReport: true,
  notify: true,
  browser: {
    inputTimeout: "180s",
    timeout: "30m"
  }
}
```

### Environment Variables

- `OPENAI_API_KEY` - GPT models
- `GEMINI_API_KEY` - Gemini 3 Pro
- `ANTHROPIC_API_KEY` - Claude models

### Do / Don't

- **Do** prefer Browser engine; use API only when explicitly requested
- **Do** always set unique `--slug` and pass `--wait` for long Pro runs
- **Do** use `--notify` for long-running operations
- **Don't** depend on interactive uploads; use inline or bundle flags
- **Don't** require manual copy/paste; extract patches from `output.log`
- **Don't** forget browser mode is macOS-only; Windows/Linux use API mode
