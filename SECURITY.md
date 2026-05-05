# Security Policy

Continuous Function is a static-exported educational site. Treat the repository,
content pipeline, and deployment channel as the main trust boundaries.

## Reporting

Please do not open a public issue for exploitable vulnerabilities, leaked
credentials, or deployment access problems. Use GitHub private vulnerability
reporting if it is available for this repository, or contact the repository
owner through GitHub.

## Local Checks

Before merging or deploying security-sensitive changes, run:

```bash
npm run security:check
npm audit --omit=dev
npm run typecheck
npm test -- --selectProjects unit --runInBand
npm run validate-content
npm run build
```

CI runs the same security checks for pull requests and before the Hostinger
deploy workflow builds `out/`.

## Deployment Rules

- Use only FTPS or SFTP for Hostinger uploads.
- Keep deploy credentials in GitHub Actions secrets or local environment
  variables, never in committed files.
- Rotate Hostinger credentials after any suspected plaintext FTP use, local
  machine compromise, or accidental secret exposure.
- Keep `.github/workflows/*` actions pinned to commit SHAs.
- Verify the live site sends the headers from `public/.htaccess` after each
  deployment.

## Content Rules

- Domain concept `content.mdx` is rendered as inert Markdown through
  `lib/safeMdx.ts`; do not execute content MDX as JavaScript.
- New `dangerouslySetInnerHTML` call sites require explicit sanitizer review
  and an allowlist update in `scripts/security-check.js`.
- External links opened in a new tab must use `rel="noopener noreferrer"`.
