# Deployment Guide: Continuous Function

Since your project is a Next.js application, you cannot simply upload the source files (`.tsx`, `.ts`) to the FTP server. You must **build** the project into static HTML/CSS/JS files first.

## 1. Fix Build Errors
Currently, the build fails because of missing types for `react-d3-graph`.
Create a file named `types.d.ts` in your project root (or inside a `types` folder) with this content:

```typescript
declare module 'react-d3-graph';
```

## 2. Configure for Static Export
Open `next.config.mjs` and ensure you have the `output: 'export'` setting enabled. This tells Next.js to generate a purely static site.

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // ... other config
};

export default nextConfig;
```

## 3. Build the Project
Run the build command in your terminal:

```bash
npm run build
```

This will create an `out` folder containing the static site.

## 4. Upload to Hostinger via FTP

### Important: FTP Root Path

The Hostinger FTP account starts in `/public_html/` but the **actual web root is the parent directory**. This means:
- When you connect via FTP, you land in `/public_html/`
- You must `cd ..` to get to the actual web-serving directory
- Use `remotePath: "/.."` or navigate up one level before uploading

### Using lftp (Command Line)

```bash
cd /path/to/continiousfunction
npm run build
lftp -c "
set ftp:ssl-allow no
open -u u908281807.u908281808,'YOUR_PASSWORD' ftp://ftp.continuousfunction.ai
cd ..
mirror -R --verbose --exclude public_html/ out/ .
bye
"
```

Note: The `cd ..` navigates to the actual web root, and `--exclude public_html/` prevents overwriting the (empty) public_html folder.

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
| Using `remotePath: "/public_html"` | Creates nested `public_html/public_html/` | Use `remotePath: "/"` |
| Uploading the `out` folder itself | Site files in wrong location | Upload contents OF `out`, not `out` itself |
| Forgetting to build first | Source files uploaded instead of compiled | Always run `npm run build` first |

## 5. Enable Clean URLs (.htaccess)

Next.js static export generates `.html` files, but the site uses clean URLs (e.g., `/pillars/optimization` not `/pillars/optimization.html`).

Create `out/.htaccess` with this content (already included in the build):

```apache
# Enable clean URLs (remove .html extension)
RewriteEngine On

# If the request doesn't have an extension and isn't a directory
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME}.html -f

# Serve the .html file
RewriteRule ^(.*)$ $1.html [L]
```

This file must be uploaded to the web root along with the other files.

## 6. Verify Deployment

After uploading, verify these files exist at web root (FTP `cd ..`):
- `index.html`
- `404.html`
- `.htaccess`
- `_next/` folder (contains JS/CSS)
- `pillars/` folder
- `concepts/` folder

Test URLs:
- https://continuousfunction.ai/ (homepage)
- https://continuousfunction.ai/pillars/optimization (should work without .html)
