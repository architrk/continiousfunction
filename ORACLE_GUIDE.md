# Oracle CLI Guide (Browser Engine, Manual Login)

This repo uses **Oracle CLI** in **browser mode** to run deep discovery/review/implementation prompts with large file context.

Key principle: **manual login always**. We do that by running Oracle against a **dedicated Chrome profile** where you are already signed into ChatGPT.

---

## Quick Start (Recommended: Remote Chrome Profile)

1. Start a dedicated Chrome instance with a persistent profile + DevTools port.

Recommended (macOS helper):

```bash
./scripts/oracle/start-chrome-profile.sh 9223 "$HOME/ChromeOracleProfileA"
```

Alternative (manual command; less reliable on macOS):

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9223 \
  --user-data-dir "$HOME/ChromeOracleProfileA" \
  --no-first-run --no-default-browser-check \
  "https://chatgpt.com/" >/dev/null 2>&1 &
```

2. Verify DevTools is reachable:

```bash
curl -sS --max-time 2 http://127.0.0.1:9223/json/version
```

3. In that Chrome window, **log into ChatGPT manually** (once). Keep the window open.

4. Run Oracle against that Chrome session:

```bash
oracle --engine browser --model "gpt-5 pro" --wait \
  --remote-chrome 127.0.0.1:9223 \
  --slug "cf-some-query" \
  --prompt "..." \
  --file "data/foundationsData.ts" \
  --file "data/visualizationMappings.ts" \
  --write-output "responses/cf-some-query.md" \
  --browser-attachments always \
  --browser-bundle-files \
  --timeout auto \
  --heartbeat 60
```

---

## Key Flags (Oracle 0.8.x)

- `--engine browser`: run via ChatGPT automation (required for browser sessions)
- `--model "gpt-5 pro"` (or `"gpt-5.2-pro"`): which model to select in ChatGPT
- `--remote-chrome host:port`: attach to a running Chrome DevTools endpoint (preferred for reliability + parallel runs)
- `--chatgpt-url <url>`: optional, force a specific ChatGPT URL (useful for projects/workspaces)
- `--slug "<kebab-case>"`: stable session id
- `--prompt "<text>"`: prompt text
- `--file <paths...>`: attach files/dirs/globs (quote globs; prefix with `!` to exclude)
- `--write-output responses/<file>.md`: save the final assistant message
- `--browser-attachments always`: always upload attachments (more reliable than pasting huge bundles)
- `--browser-bundle-files`: upload a single archive instead of many files
- `--timeout auto|<seconds>`: overall timeout
- `--heartbeat 60`: periodic status updates (helps when runs are long)
- `--force`: rerun even if Oracle thinks an identical prompt is already running

---

## Parallel Sessions (Manual Login)

To run multiple queries in parallel, start multiple Chrome instances on different ports and profiles:

```bash
./scripts/oracle/start-chrome-profile.sh 9223 "$HOME/ChromeOracleProfileA"
./scripts/oracle/start-chrome-profile.sh 9224 "$HOME/ChromeOracleProfileB"
```

Log into ChatGPT once in each window, then run:

```bash
oracle --engine browser --model "gpt-5 pro" --wait \
  --remote-chrome 127.0.0.1:9223 \
  --slug "cf-query-a" \
  --prompt "..." \
  --file "..." \
  --write-output "responses/cf-query-a.md" &

oracle --engine browser --model "gpt-5 pro" --wait \
  --remote-chrome 127.0.0.1:9224 \
  --slug "cf-query-b" \
  --prompt "..." \
  --file "..." \
  --write-output "responses/cf-query-b.md" &
```

---

## Monitoring + Recovery

```bash
oracle status --hours 6 --limit 30
oracle session <slug>
cat ~/.oracle/sessions/<slug>/output.log
```

If `--write-output` is missing, recover from the log:

```bash
awk 'BEGIN{found=0} /^Answer:/{found=1; next} {if(found) print}' \
  ~/.oracle/sessions/<slug>/output.log > responses/<slug>.recovered.md
```

---

## Common Pitfalls

- **zsh bracket paths:** quote files like `--file 'pages/foundations/[id].tsx'`.
- **Stale-tab capture:** keep a single ChatGPT tab open per Oracle Chrome profile; if output looks unrelated, rerun with a new `--slug` and `--force`.
- **Too much parallelism:** keep to 2-4 browser sessions at a time.

---

## Prompt Templates In This Repo

We keep reusable Oracle prompts under `prompts/` (and write outputs under `responses/`).

Examples:

```bash
oracle --engine browser --model "gpt-5 pro" --wait \
  --remote-chrome 127.0.0.1:9223 \
  --slug "cf-discovery-next-5" \
  --prompt "$(cat prompts/cf-discovery-next-5.txt)" \
  --file data/foundationsData.ts \
  --file data/visualizationMappings.ts \
  --write-output responses/cf-discovery-next-5.md \
  --browser-attachments always --browser-bundle-files \
  --timeout auto --heartbeat 60
```
