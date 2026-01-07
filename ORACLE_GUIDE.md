# Oracle CLI Guide for GPT-5 Pro Queries

## Quick Start

```bash
# Check Oracle is installed
oracle --version  # Should be 0.5.0+

# Basic query with file context
oracle --engine browser --browser-chrome-profile "Profile 1" \
  --slug "my-query-name" \
  --prompt "Your prompt here" \
  --file "path/to/file.tsx" \
  --write-output "responses/output.md" \
  --browser-timeout 30m
```

## Key Flags

| Flag | Purpose |
|------|---------|
| `--engine browser` | Use browser mode (required for GPT-5 Pro) |
| `--browser-chrome-profile "Profile 1"` | Use specific Chrome profile |
| `--browser-port 922x` | (Recommended for parallel runs) Use a unique Chrome DevTools port per session |
| `--slug "name"` | Unique session ID (kebab-case, 3-5 words) |
| `--prompt "..."` | The query text |
| `--file "path"` | Attach file(s) for context |
| `--write-output "path"` | Save response to file |
| `--browser-timeout 30m` | Max wait time |
| `--force` | Allow relaunch even if duplicate prompt |
| `--browser-attachments always` | (Recommended for big contexts) Always upload attachments vs pasting inline |
| `--browser-bundle-files` | (Recommended) Bundle attachments into a single archive upload |

## Running Queries in Background

### Single Query (Background)
```bash
oracle --engine browser --browser-chrome-profile "Profile 1" \
  --slug "attention-viz" \
  --prompt "$(cat prompts/attention.txt)" \
  --file "components/*.tsx" \
  --write-output "responses/attention.md" \
  --browser-timeout 30m &

# The & runs it in background
# Output goes to ~/.oracle/sessions/attention-viz/output.log
```

### Batch Queries (Staggered)
```bash
# IMPORTANT: Stagger launches to avoid Chrome conflicts
# Wait 5-10 seconds between each launch

for prompt_file in prompts/*.txt; do
  name=$(basename "$prompt_file" .txt)
  
  oracle --engine browser --browser-chrome-profile "Profile 1" \
    --slug "$name" \
    --prompt "$(cat $prompt_file)" \
    --file "components/GradientDescentPlayground.tsx" \
    --file "lib/mathObjects.ts" \
    --write-output "responses/${name}.md" \
    --browser-timeout 30m &
  
  sleep 10  # Wait between launches to avoid Chrome conflicts
done

echo "All queries launched. Monitor with: oracle status"
```

## Monitoring Sessions

```bash
# List recent sessions
oracle status --hours 2 --limit 20

# Output shows:
# Timestamp | Chars | Cost | Status | Models | ID
# running (⌛), completed (✓), error (✖)

# Reattach to see live output
oracle session <slug-name>

# View raw log file
cat ~/.oracle/sessions/<slug-name>/output.log
```

## Handling Errors

### Common Issues

1. **Too many concurrent sessions** → Chrome can only handle ~3-5 browser sessions
   - Solution: Run in smaller batches with delays

2. **`zsh: no matches found: pages/foundations/[id].tsx`** → zsh treats `[]` as a glob character class
   - Solution: quote bracket paths: `--file 'pages/foundations/[id].tsx'`
   
3. **Session shows "error"** → Usually Chrome conflict, login/cookie issues, or a send/timeout failure
   - Solution: Close Chrome completely, relaunch with `--force`

4. **"Duplicate prompt" blocked** → Same prompt already running
   - Solution: Add `--force` flag or use different `--slug`

5. **Prompt send fails (“Prompt did not appear…”)** → often indicates ChatGPT UI/send failed (sometimes due to large context)
   - Solutions:
     - Reduce attached files (or attach a summarized context file instead of huge sources).
     - Prefer `--browser-attachments always --browser-bundle-files` for large contexts.
     - Retry with `--force` and a fresh `--slug`.

### Relaunch Failed Sessions
```bash
# Check which failed
oracle status --hours 2 | grep error

# Relaunch with -r suffix and --force
oracle --engine browser --browser-chrome-profile "Profile 1" \
  --slug "failed-query-r" \
  --prompt "$(cat prompts/failed-query.txt)" \
  --file "components/*.tsx" \
  --write-output "responses/failed-query.md" \
  --browser-timeout 30m --force &
```

## Best Practices

### 1. Close Chrome Before Batch Runs
```bash
# Kill all Chrome processes before starting batch
pkill -f "Google Chrome"
sleep 3

# Then start your queries
```

### 2. Use Unique Slugs
```bash
# Good: descriptive, unique
--slug "attention-geometry-viz"
--slug "diffusion-score-demo"

# Bad: generic, will conflict
--slug "test"
--slug "query1"
```

### 3. Limit Concurrent Sessions
```bash
# Run max 3-5 at a time
# Wait for completion before launching more

# Launch batch of 3
for i in 01 02 03; do
  # ... launch command ...
  sleep 10
done

# Wait and check
sleep 600  # 10 minutes
oracle status

# If done, launch next batch
```

### 4. Save Prompts to Files
```bash
# Instead of inline prompts, save to files
echo "Your detailed prompt here..." > prompts/my-query.txt

# Then reference in command
--prompt "$(cat prompts/my-query.txt)"
```

### 5. Recover Output if `--write-output` Didn’t Write
Sometimes the session completes but your `--write-output` file is missing (e.g., interrupted local process).
You can always recover from:

```bash
cat ~/.oracle/sessions/<slug-name>/output.log
```

If you want just the assistant answer section:

```bash
awk 'BEGIN{found=0} /^Answer:/{found=1; next} {if(found) print}' \
  ~/.oracle/sessions/<slug-name>/output.log > responses/<your-file>.txt
```

## Complete Example: Running 15 Visualization Queries

```bash
#!/bin/bash
cd /path/to/project

# Create output directory
mkdir -p responses/deep-dive

# Kill existing Chrome to start fresh
pkill -f "Google Chrome"
sleep 5

# Function to launch a batch
launch_batch() {
  local start=$1
  local end=$2
  
  for i in $(seq -f "%02g" $start $end); do
    prompt_file=$(ls prompts/deep-dive/${i}-*.txt 2>/dev/null | head -1)
    if [ -f "$prompt_file" ]; then
      name=$(basename "$prompt_file" .txt)
      
      oracle --engine browser --browser-chrome-profile "Profile 1" \
        --slug "deep-${name}" \
        --prompt "$(cat $prompt_file)" \
        --file "components/GradientDescentPlayground.tsx" \
        --file "lib/mathObjects.ts" \
        --write-output "responses/deep-dive/${name}.md" \
        --browser-timeout 45m &
      
      echo "Launched: $name"
      sleep 10
    fi
  done
}

# Launch in batches of 3
echo "=== Batch 1 (01-03) ==="
launch_batch 1 3

echo "Waiting 15 minutes for batch 1..."
sleep 900

echo "=== Checking status ==="
oracle status --hours 1

echo "=== Batch 2 (04-06) ==="
launch_batch 4 6

# Continue pattern...
```

## Collecting Results

```bash
# Check which completed
oracle status --hours 4 | grep completed

# Results are in your --write-output paths
ls -la responses/deep-dive/

# Or extract from session logs
for session in ~/.oracle/sessions/deep-*; do
  slug=$(basename "$session")
  echo "=== $slug ==="
  tail -100 "$session/output.log"
done
```

## Troubleshooting

### Session stuck on "running" forever
```bash
# Check if Chrome is actually running
pgrep -f "Google Chrome"

# If not, the session is orphaned - relaunch
oracle --slug "stuck-session-r" --force ...
```

### "Prompt did not appear" error
- Usually means Chrome opened but couldn't navigate to ChatGPT
- Close Chrome, wait 30s, retry

### Output file empty
- Check session log: `cat ~/.oracle/sessions/<slug>/output.log`
- Response might be in log even if write failed

## Quick Reference

```bash
# Launch single query
oracle --engine browser --browser-chrome-profile "Profile 1" \
  --slug "my-query" --prompt "..." --file "*.tsx" \
  --write-output "out.md" --browser-timeout 30m &

# Check status
oracle status --hours 2

# Reattach to session
oracle session my-query

# View log
cat ~/.oracle/sessions/my-query/output.log

# Kill Chrome before batch
pkill -f "Google Chrome" && sleep 5

# Relaunch failed with force
oracle ... --slug "my-query-r" --force &
```
