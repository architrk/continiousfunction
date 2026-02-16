## Prioritized issues (highest impact first)

1. **Hostinger “web root is parent of `public_html`” is incorrect / unsafe**

* Hostinger’s own docs say your site’s root is **generally `public_html`**, and you should place website files **inside `public_html`**. Uploading “one level above” can make the site not load and may not even be accessible due to FTP chroot. ([Hostinger][1])

2. **Your `.htaccess` “clean URLs” rule is incompatible with `trailingSlash: true`**

* With `trailingSlash: true` **and** `output: "export"`, Next.js emits pages as **`/route/index.html`**, not `route.html`. Your rule rewrites `/pillars/optimization` → `/pillars/optimization.html`, which will not exist and can cause 404s. ([Next.js][2])

3. **Guide claims Next export generates “`.html files” for routes (outdated for your config)**

* That’s only the default (`trailingSlash: false`). With your config, route outputs are directories with `index.html`. ([Next.js][2])

4. **Step “Fix Build Errors” about `react-d3-graph` is stale / misleading**

* `react-d3-graph` isn’t in the provided `package.json`, so this section will confuse future deployers and isn’t deployment-specific.

5. **Guide implies `.htaccess` is “already included in the build”**

* Next.js doesn’t “generate” `.htaccess`. You must ensure it’s copied into `out/` (e.g., via a `postbuild` copy step) if you want one.

6. **Security + operational risk: inline passwords & `set ftp:ssl-allow no`**

* The example encourages sending credentials over plain FTP and pasting passwords into shell commands (leaks to shell history / process list). Prefer FTPS if Hostinger supports it, and always source credentials from env vars / secrets. (Your Hostinger stack is LiteSpeed with `.htaccess` as the supported config mechanism.) ([Hostinger][3])

7. **Static export constraints not called out**

* Next static export does **not** support many server-dependent features (e.g., redirects/rewrites/headers in Next config, API routes, ISR, default `next/image` optimization). This should be explicit in the guide. ([Next.js][4])

---

## Updated `DEPLOYMENT_GUIDE.md` (replacement)

````md
# Deployment Guide (Next.js Static Export → Hostinger via FTP)

This project is configured for a **pure static export**:

- `output: "export"` → `next build` produces a static site in `out/`
- `trailingSlash: true` → routes are emitted as **folders with `index.html`**
  (e.g. `/pillars/optimization/` → `out/pillars/optimization/index.html`)

> Note: Static export means **no Node.js server is required on Hostinger**. You upload the `out/` contents as static files.  
> Also note: some Next.js features require a server and will not work in static export. See “Static export constraints” below.

---

## 1) Build the static site

Install dependencies and build:

```bash
npm ci
npm run build
````

After `next build`, Next.js will create an `out/` folder containing your site.
With `trailingSlash: true`, routes are emitted as directories with `index.html`.
(Example: `/about` emits `/about/index.html` instead of `/about.html`.)

### Local preview (recommended)

Do **not** use `next start` to preview the exported site. Instead, serve `out/` as static files:

```bash
npx serve out
# or
python -m http.server 3000 --directory out
```

---

## 2) Static export constraints (important)

Static export does not support server-only features such as:

* `redirects()`, `rewrites()`, `headers()` in Next config
* API routes
* ISR / dynamic rendering features that need a server
* `next/image` optimization with the **default** loader (use a custom loader if you need it)

If you need any of the above, you cannot deploy as a pure static export.

---

## 3) Find the correct Hostinger document root

On Hostinger, your website’s root is **generally `public_html`**.
To confirm the exact path for your account/domain:

* In hPanel → **FTP Accounts**, Hostinger shows the root folder path (often something like:
  `/home/uXXXXX/domains/<domain>/public_html` or `/home/uXXXXX/public_html`).
* In File Manager, ensure site files are placed **inside `public_html`**.

> Do NOT `cd ..` above `public_html` unless Hostinger explicitly shows your FTP user is rooted above it.

---

## 4) Upload `out/` contents to Hostinger

**Goal:** the files inside `out/` should end up directly in your domain’s document root
(usually `public_html/`).

After upload, you should see at least:

* `public_html/index.html`
* `public_html/404.html`
* `public_html/_next/` (static JS/CSS)
* `public_html/pillars/` and `public_html/concepts/` (or whatever routes exist)

---

## 5) Clean URLs and trailing slashes (how it works here)

Because `trailingSlash: true` is enabled:

* Canonical URLs are **with trailing slash**:

  * ✅ `/pillars/optimization/`
  * (Typically) `/pillars/optimization` will 301 → `/pillars/optimization/` on Apache/LiteSpeed
* You do **NOT** need an `.htaccess` rule that rewrites extensionless URLs to `*.html`.
  That rule is for the `trailingSlash: false` case where exports are `page.html`.

If you ever switch to `trailingSlash: false`, then you can add an Apache rewrite to map
`/route` → `/route.html`. But with the current config, do not do that.

---

## 6) Optional `.htaccess` (keep minimal)

With `trailingSlash: true`, you typically don’t need rewrites at all.
If you want to reduce duplicate URLs (e.g. `/foo/index.html`), you can use:

```apache
# public_html/.htaccess
RewriteEngine On

# Redirect /something/index.html -> /something/
RewriteCond %{THE_REQUEST} \s/+(.*/)?index\.html[\s?] [NC]
RewriteRule ^ %1 [R=301,L]

# Optional: use Next’s exported 404 page
ErrorDocument 404 /404.html
```

If you include an `.htaccess`, ensure it is uploaded into the document root alongside `index.html`.

---

## 7) Verify deployment

Test:

* [https://continuousfunction.ai/](https://continuousfunction.ai/)
* [https://continuousfunction.ai/pillars/optimization/](https://continuousfunction.ai/pillars/optimization/)   (note trailing slash)
* [https://continuousfunction.ai/concepts/](https://continuousfunction.ai/concepts/)...

If a deep route 404s:

* Confirm the directory exists on the server:
  `public_html/pillars/optimization/index.html`
* Confirm you didn’t upload a nested `out/` folder (must upload **contents** of `out/`)

````

**Why these edits are “current Next.js behavior”:**
- Static export is enabled by `output: "export"` and is produced by `next build` into `out/`. :contentReference[oaicite:5]{index=5}  
- With `trailingSlash: true` + `output: "export"`, `/about` outputs `/about/index.html`. :contentReference[oaicite:6]{index=6}  
- Hostinger root directory guidance centers on `public_html`. :contentReference[oaicite:7]{index=7}  

---

## Proposed deploy scripts (safe FTP upload of `out/`, no secrets committed)

### 1) Add dev dependencies

```bash
npm i -D @samkirkland/ftp-deploy cross-env
````

* `@samkirkland/ftp-deploy` syncs a folder to FTP/FTPS and uses a sync-state file for fast incremental deploys. ([GitHub][5])
* `cross-env` makes env-var flags work on Windows/macOS/Linux.

### 2) Create `scripts/deploy-ftp.cjs`

```js
#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const { deploy, excludeDefaults } = require("@samkirkland/ftp-deploy");

  const server =
    process.env.FTP_SERVER ||
    process.env.FTP_HOST ||
    process.env.HOST;

  const username =
    process.env.FTP_USERNAME ||
    process.env.FTP_USER ||
    process.env.USERNAME;

  const password =
    process.env.FTP_PASSWORD ||
    process.env.FTP_PASS ||
    process.env.PASSWORD;

  if (!server) throw new Error("Missing FTP_SERVER (or FTP_HOST).");
  if (!username) throw new Error("Missing FTP_USERNAME (or FTP_USER).");
  if (!password) throw new Error("Missing FTP_PASSWORD (or FTP_PASS).");

  const localDirRaw = process.env.FTP_LOCAL_DIR || "out/";
  const serverDirRaw = process.env.FTP_SERVER_DIR || "./"; // Hostinger often chroots FTP users to public_html

  const ensureTrailingSlash = (p) => (p.endsWith("/") ? p : `${p}/`);

  const localDir = ensureTrailingSlash(localDirRaw);
  const serverDir = ensureTrailingSlash(serverDirRaw);

  const outAbs = path.resolve(process.cwd(), localDir);
  if (!fs.existsSync(outAbs)) {
    throw new Error(
      `Local dir "${localDir}" not found. Did you run "npm run build" first?`
    );
  }

  const port = Number(process.env.FTP_PORT || 21);

  // Prefer FTPS if your host supports it. Default to "ftp" to avoid surprise failures.
  const protocol = (process.env.FTP_PROTOCOL || "ftp").toLowerCase();
  if (!["ftp", "ftps", "ftps-legacy"].includes(protocol)) {
    throw new Error(`FTP_PROTOCOL must be one of: ftp | ftps | ftps-legacy`);
  }

  const dryRun =
    (process.env.FTP_DRY_RUN || "").toLowerCase() === "true" ||
    process.env.FTP_DRY_RUN === "1";

  // WARNING: this will delete *everything* in server-dir, even excluded items.
  const dangerousCleanSlate =
    (process.env.FTP_CLEAN_SLATE || "").toLowerCase() === "true" ||
    process.env.FTP_CLEAN_SLATE === "1";

  const logLevel = (process.env.FTP_LOG_LEVEL || "standard").toLowerCase();
  if (!["minimal", "standard", "verbose"].includes(logLevel)) {
    throw new Error(`FTP_LOG_LEVEL must be: minimal | standard | verbose`);
  }

  const security = (process.env.FTP_SECURITY || "loose").toLowerCase();
  if (!["strict", "loose"].includes(security)) {
    throw new Error(`FTP_SECURITY must be: strict | loose`);
  }

  const timeout = Number(process.env.FTP_TIMEOUT || 30000);

  console.log("FTP deploy config:");
  console.log({
    server,
    username,
    port,
    protocol,
    localDir,
    serverDir,
    dryRun,
    dangerousCleanSlate,
    logLevel,
    security,
    timeout,
  });

  await deploy({
    server,
    username,
    password,
    port,
    protocol,
    "local-dir": localDir,
    "server-dir": serverDir,
    "state-name": process.env.FTP_STATE_NAME || ".ftp-deploy-sync-state.json",
    "dry-run": dryRun,
    "dangerous-clean-slate": dangerousCleanSlate,
    "log-level": logLevel,
    security,
    timeout,
    exclude: [
      ...excludeDefaults,
      "**/.DS_Store",
      "**/Thumbs.db",
    ],
  });

  console.log("✅ Deploy finished");
}

main().catch((err) => {
  console.error("❌ Deploy failed");
  console.error(err);
  process.exit(1);
});
```

This uses the library’s documented argument keys (notably `"local-dir"` / `"server-dir"`, which must end with `/`). ([GitHub][6])

### 3) Optional: ensure `.htaccess` is copied into `out/`

Create `hosting/.htaccess` (committed):

```apache
RewriteEngine On

# Redirect /something/index.html -> /something/
RewriteCond %{THE_REQUEST} \s/+(.*/)?index\.html[\s?] [NC]
RewriteRule ^ %1 [R=301,L]

ErrorDocument 404 /404.html
```

Create `scripts/postbuild-copy-hosting.cjs`:

```js
#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");

const src = path.resolve(process.cwd(), "hosting", ".htaccess");
const outDir = path.resolve(process.cwd(), "out");
const dest = path.join(outDir, ".htaccess");

if (!fs.existsSync(src)) {
  console.log("No hosting/.htaccess found; skipping.");
  process.exit(0);
}

if (!fs.existsSync(outDir)) {
  console.error('out/ not found. Run "npm run build" first.');
  process.exit(1);
}

fs.copyFileSync(src, dest);
console.log("Copied hosting/.htaccess -> out/.htaccess");
```

### 4) Add npm scripts (copy-paste into `package.json`)

```json
{
  "scripts": {
    "preview": "npx serve out",
    "postbuild": "node scripts/postbuild-copy-hosting.cjs",

    "deploy:ftp": "npm run build && node scripts/deploy-ftp.cjs",
    "deploy:ftp:dry": "npm run build && cross-env FTP_DRY_RUN=1 node scripts/deploy-ftp.cjs",
    "deploy:ftp:clean": "npm run build && cross-env FTP_CLEAN_SLATE=1 node scripts/deploy-ftp.cjs"
  }
}
```

**Local usage (no secrets committed):**

```bash
# macOS/Linux
export FTP_SERVER="ftp.continuousfunction.ai"
export FTP_USERNAME="your_user"
export FTP_PASSWORD="your_pass"
export FTP_SERVER_DIR="./"          # or "public_html/" depending on your FTP root
export FTP_PROTOCOL="ftps"          # if supported; otherwise "ftp"
npm run deploy:ftp
```

---

## GitHub Actions workflow skeleton (build + deploy via FTP secrets)

Create `.github/workflows/deploy.yml`:

```yml
name: Deploy (Hostinger FTP)

on:
  push:
    branches: [ main ]
  workflow_dispatch:

concurrency:
  group: hostinger-ftp-deploy
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install
        run: npm ci

      - name: Build static export
        run: npm run build

      # Optional sanity check (helps catch "out/" missing)
      - name: List out/
        run: ls -la out && test -f out/index.html

      - name: Deploy via FTP
        uses: SamKirkland/FTP-Deploy-Action@v4.3.6
        with:
          server: ${{ secrets.FTP_SERVER }}
          username: ${{ secrets.FTP_USERNAME }}
          password: ${{ secrets.FTP_PASSWORD }}

          # Recommended if your host supports it:
          protocol: ${{ secrets.FTP_PROTOCOL }} # ftp | ftps | ftps-legacy
          port: ${{ secrets.FTP_PORT }}         # usually 21 (ftp) or 990 (implicit ftps), depends on host

          local-dir: out/
          server-dir: ${{ secrets.FTP_SERVER_DIR }} # MUST end with '/'

          # Safer defaults:
          dry-run: false
          dangerous-clean-slate: false
          security: loose
          log-level: standard

          exclude: |
            **/.git*
            **/.git*/**
            **/node_modules/**
            **/.DS_Store
```

Action parameter meanings and the required trailing slashes are documented in the action’s README. ([GitHub][7])

**Repository secrets to add:**

* `FTP_SERVER` → e.g. `ftp.continuousfunction.ai`
* `FTP_USERNAME`
* `FTP_PASSWORD`
* `FTP_SERVER_DIR` → `./` (common if FTP is chrooted to `public_html`) **or** `public_html/` (if your FTP root is above it). Must end with `/`. ([GitHub][7])
* Optional: `FTP_PROTOCOL` (`ftps` recommended when available) and `FTP_PORT`

---

If you want, I can also provide a **“trailing slash OFF”** variant of the guide + Apache rules (for canonical `/pillars/optimization` without redirect), but with your current `trailingSlash: true` config the simplest and most robust Hostinger behavior is to treat `/route/` as canonical and avoid any `.html` rewrite rules. ([Next.js][2])

[1]: https://www.hostinger.com/support/1583494-what-is-the-path-to-your-website-s-root-home-directory-and-how-to-change-it-in-hostinger/ "What Is the Path to Your Website’s Root Home Directory and How to Change It in Hostinger? - Hostinger Help Center"
[2]: https://nextjs.org/docs/app/api-reference/config/next-config-js/trailingSlash "next.config.js: trailingSlash | Next.js"
[3]: https://www.hostinger.com/support/1583334-is-editing-httpd-conf-possible-at-hostinger/ "Is Editing httpd.conf Possible at Hostinger? - Hostinger Help Center"
[4]: https://nextjs.org/docs/pages/guides/static-exports "Guides: Static Exports | Next.js"
[5]: https://github.com/SamKirkland/ftp-deploy "https://github.com/SamKirkland/ftp-deploy"
[6]: https://raw.githubusercontent.com/SamKirkland/ftp-deploy/master/src/types.ts "raw.githubusercontent.com"
[7]: https://github.com/SamKirkland/FTP-Deploy-Action "https://github.com/SamKirkland/FTP-Deploy-Action"
