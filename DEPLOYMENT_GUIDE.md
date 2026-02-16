# Deployment Guide: Continuous Function

Continuous Function is deployed as a **Next.js static export**. You upload the **built output** (the `out/` folder), not the source `.tsx/.ts` files.

## 1. Build the Project
Run the build command in your terminal:

```bash
npm run build
```

This produces an `out/` folder containing the static site (HTML/CSS/JS).

Notes:
- Static export is configured in `next.config.mjs` via `output: 'export'` and `trailingSlash: true`.
- `npm run build` also runs `npm run generate-content` (via `prebuild`) to keep the filesystem-driven `/domains/*` pages wired up.

## 2. Clean URLs + .htaccess

We export with `trailingSlash: true`, so routes are exported as folders with `index.html` (e.g. `out/pillars/optimization/index.html`). Apache can serve these clean URLs without special rewrite rules.

We still ship a small `public/.htaccess` for security headers + caching. It is copied into `out/.htaccess` during export, so it will be deployed automatically as long as you upload the `out/` contents.

## 3. Upload to Hostinger via FTP

### Important: FTP Root Path

Hostinger setups vary. Before your first deploy, confirm where the **web root** is for this account:

```bash
lftp -c \"set ftp:ssl-allow no; open -u USER,PASS ftp://HOST; pwd; ls; bye\"
```

Pick the directory that should contain `index.html` and `_next/`, and use that as the remote deploy directory.

### Using lftp (Command Line)

```bash
cd /path/to/continiousfunction
npm run build
lftp -c "
set ftp:ssl-allow no
open -u u908281807.u908281808,'YOUR_PASSWORD' ftp://ftp.continuousfunction.ai
cd /your/remote/webroot
mirror -R --verbose out/ .
bye
"
```

If you want to remove remote files that no longer exist locally, add `--delete` to `mirror` (use with care).

### Using the repo deploy script (recommended)

Install `lftp`:

```bash
brew install lftp
```

Set env vars and deploy:

```bash
export CF_FTP_HOST="ftp.continuousfunction.ai"
export CF_FTP_USER="u908281807.u908281808"
export CF_FTP_PASS="YOUR_PASSWORD"
export CF_FTP_REMOTE_DIR="/your/remote/webroot"  # e.g. /public_html or ..

# Optional: also delete remote files that no longer exist locally.
export CF_FTP_DELETE=1

npm run deploy:hostinger
```

### Optional: GitHub Actions (CI deploy)

If this repo is hosted on GitHub, there is a workflow at `.github/workflows/deploy-hostinger.yml` that builds and deploys on pushes to `main`.

Required repository secrets:
- `CF_FTP_HOST`
- `CF_FTP_USER`
- `CF_FTP_PASS`
- `CF_FTP_REMOTE_DIR` (example: `/public_html/`)

### Using Cursor SFTP Extension

Update `.vscode/sftp.json`:

```json
{
    "name": "Hostinger - continuousfunction.ai",
    "host": "ftp.continuousfunction.ai",
    "protocol": "ftp",
    "port": 21,
    "username": "u908281807.u908281808",
    "password": "YOUR_PASSWORD",
    "remotePath": "/",
    "context": "out",
    "uploadOnSave": false
}
```

**Key settings:**
- `"remotePath": "/"` - Upload to FTP root (which IS public_html due to chroot)
- `"context": "out"` - Only upload contents of the `out` folder

Then, after building:
1. Right-click the `out` folder
2. Select **SFTP: Upload**

### Common Mistakes

| Mistake | Result | Fix |
|---------|--------|-----|
| Uploading the `out` folder itself | Site files in wrong location | Upload contents OF `out`, not `out` itself |
| Forgetting to build first | Source files uploaded instead of compiled | Always run `npm run build` first |
| Deploying to the wrong remote directory | 404s everywhere | Confirm web root with `pwd` + `ls` before the first deploy |

## 4. Verify Deployment

After uploading, verify these files exist at the configured web root:
- `index.html`
- `404.html`
- `.htaccess`
- `_next/` folder (contains JS/CSS)
- `pillars/` folder
- `concepts/` folder
- `domains/` folder

Test URLs:
- https://continuousfunction.ai/ (homepage)
- https://continuousfunction.ai/pillars/optimization/ (trailing slash)
- https://continuousfunction.ai/foundations/adam/ (legacy)
- https://continuousfunction.ai/domains/linear-algebra/vector-spaces/ (filesystem content)
