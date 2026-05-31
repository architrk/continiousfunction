# Oracle CLI Guide

This repo uses `@steipete/oracle` browser mode for second-model review and large-context checks.

## Correct Setup

Use Oracle's documented macOS browser flow:

```bash
oracle --engine browser --browser-manual-login
```

For this repo, the persistent Oracle browser profile is fixed at:

```text
~/.oracle/browser-profile-continuous-function
```

That profile must be logged into ChatGPT as:

```text
Archit Khare / adrinkscoffee@gmail.com
```

This is separate from normal Chrome `Profile 2`. That is intentional: Oracle's docs recommend `--browser-manual-login` on macOS because it avoids copying cookies from normal Chrome and avoids macOS Keychain permission failures. Do not use ad hoc `--remote-chrome` profiles for this repo.

## First Login

Run:

```bash
./scripts/oracle/login.sh
```

In the opened Oracle Chrome window, sign into ChatGPT with `adrinkscoffee@gmail.com`, then leave that window/profile available. Future runs reuse the same profile.

## Normal Runs

Use:

```bash
./scripts/oracle/run.sh <slug> <prompt-file> <write-output> [--file <path> ...]
```

Example:

```bash
./scripts/oracle/run.sh cf-discovery-next5-20260501 \
  prompts/cf-discovery-next-5.txt responses/cf-discovery-next5-20260501.md \
  --file data/foundationsData.ts \
  --file data/visualizationMappings.ts
```

The wrapper forces:

- `ORACLE_BROWSER_PROFILE_DIR=~/.oracle/browser-profile-continuous-function`
- `--engine browser`
- `--browser-manual-login`
- `--browser-keep-browser`
- `--browser-model-strategy ignore`
- `--browser-auto-reattach-delay 5s`
- `--browser-auto-reattach-interval 3s`
- `--browser-auto-reattach-timeout 60s`
- `--browser-attachments ${ORACLE_BROWSER_ATTACHMENTS:-never}`
- no `--browser-bundle-files` unless `ORACLE_BROWSER_BUNDLE_FILES=1` and uploads are enabled
- `--write-output responses/...`

The default file-context mode is intentionally `never`. In Oracle's browser docs, that means text files from
`--file` are pasted inline into the ChatGPT composer instead of uploaded as file chips. For this repo that is the
safest default because most Oracle work is source-code review, and inline text is easier for GPT-Pro to inspect
than a detachable upload.

To force true uploads, use:

```bash
ORACLE_BROWSER_ATTACHMENTS=always ORACLE_BROWSER_BUNDLE_FILES=0 ./scripts/oracle/run.sh ...
```

To restore Oracle's upstream automatic behavior, use:

```bash
ORACLE_BROWSER_ATTACHMENTS=auto ./scripts/oracle/run.sh ...
```

Do not enable bundled browser uploads by default. Bundled uploads can create ChatGPT attachment chips such as
`attachments-bundle(198).txt`; Oracle's upload-readiness check can then wait forever for the exact bundle filename
and fail with `Attachments never reached a clickable send button before timeout.`

This repo also carries a local patch helper for Oracle's browser upload-readiness check:

```bash
node scripts/oracle/patch-local-attachment-readiness.js
```

Run it after reinstalling or upgrading `@steipete/oracle`. It teaches the local Oracle install to accept the current
ChatGPT file-chip text pattern where uploaded files may appear as `name(123).ext` followed by a `Document` label,
even when the older chip selectors return no nodes.

## Preview Before Sending

```bash
./scripts/oracle/run.sh cf-preview-20260501 \
  prompts/cf-quality-review-concept.txt responses/cf-preview-20260501.md \
  --dry-run summary \
  --file components/foundations \
  --file "!components/foundations/*.test.tsx"
```

For serious runs with files, preview first and confirm the delivery path:

- `includes N inline files` means the files will be pasted into the prompt.
- `attachments excluded` means the prompt will rely on file uploads.
- If the preview unexpectedly switches to uploads, either reduce the file set or run with
  `ORACLE_BROWSER_ATTACHMENTS=never`.

## Attachment Smoke Test

Before trusting true browser uploads after a ChatGPT UI change, run:

```bash
./scripts/oracle/smoke-attachments.sh
```

The smoke creates one tiny markdown attachment under `responses/oracle-smoke/`, asks GPT-Pro to echo a sentinel
from that file, and fails unless the saved response contains both success markers.

Useful variants:

```bash
# Test Oracle's inline file path, without upload chips.
ORACLE_BROWSER_ATTACHMENTS=never ./scripts/oracle/smoke-attachments.sh

# Test true upload chips without bundling.
ORACLE_BROWSER_ATTACHMENTS=always ORACLE_BROWSER_BUNDLE_FILES=0 ./scripts/oracle/smoke-attachments.sh
```

## Sessions

```bash
oracle status --hours 72 --limit 50
oracle session <slug> --render
tail -f ~/.oracle/sessions/<slug>/output.log
```

If a browser run detaches or times out, reattach to the saved session instead of starting a duplicate request.

Do not count a GPT-Pro/Oracle query as submitted just because a browser tab exists. A valid run should have at
least one of these:

- a completed Oracle session and non-empty `--write-output` file
- `~/.oracle/sessions/<slug>/meta.json` showing `browser.runtime.promptSubmitted: true`
- a ChatGPT conversation whose composer is empty and whose response has started

If an upload run fails with `Attachments never reached a clickable send button before timeout`, do not retry the
same bundled-upload command. First reapply the local readiness patch and run the attachment smoke:

```bash
node scripts/oracle/patch-local-attachment-readiness.js
ORACLE_BROWSER_ATTACHMENTS=always ORACLE_BROWSER_BUNDLE_FILES=0 ./scripts/oracle/smoke-attachments.sh
```

If true uploads are still failing, switch source-code reviews back to inline mode:

```bash
ORACLE_BROWSER_ATTACHMENTS=never ORACLE_BROWSER_BUNDLE_FILES=0 ./scripts/oracle/run.sh ...
```

## Do Not Use

- Do not use normal Chrome `Profile 2` cookie-copy as the default path.
- Do not use `scripts/oracle/start-chrome-profile.sh`.
- Do not use one-off `--remote-chrome` profiles unless the user explicitly asks.
- Do not delete `~/.oracle/browser-profile-continuous-function` unless you intentionally want to sign in again.
