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

This will create an `out` folder (or simply populate `.next` depending on version, but `out` is standard for static exports).

## 4. Upload to Hostinger via FTP
The contents of the **`out`** folder are what need to go to your server.

1.  Open your FTP client (or use the configured Cursor SFTP).
2.  Navigate to the `out` folder in your local project.
3.  Upload **ALL** files and folders inside `out` to the `public_html` folder on your Hostinger server.
    *   Do NOT upload the `out` folder itself, just its contents.

### Using Cursor SFTP Extension
If you want to use the Cursor SFTP extension, you need to map your local `out` folder to the remote server root.

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
    "context": "out",  // <--- IMPORTANT: Only upload from the 'out' folder
    "uploadOnSave": false // Disable auto-upload since you need to build first
}
```

Then, after building:
1.  Right-click the `out` folder.
2.  Select **SFTP: Upload**.
