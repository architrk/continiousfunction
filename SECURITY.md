# Security Policy

Security fixes are applied on the active `main` branch.

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

For a production deployment, also run:

```bash
npm run verify:deployment-readiness
npm run verify:production -- https://your-domain/
```

## Deployment Rules

- This project is moving from a static-exported atlas to a Vercel-hosted Next.js platform for logged-in learner memory, profiles, and research collaboration. Static export remains available only for archival mirrors via `CF_STATIC_EXPORT=1`.
- Use only FTPS or SFTP for Hostinger uploads.
- Keep deploy credentials in GitHub Actions secrets or local environment
  variables, never in committed files.
- Rotate Hostinger credentials after any suspected plaintext FTP use, local
  machine compromise, or accidental secret exposure.
- Keep `.github/workflows/*` actions pinned to commit SHAs.
- Verify the live site sends the hardened headers from `vercel.json` or, for static mirrors, `public/.htaccess` after each deployment.
- Provider API keys, database URLs, Clerk secret keys, payment secrets, and OCR keys must stay server-side and must never be exposed through `NEXT_PUBLIC_*` variables.
- Browsers must never connect directly to Postgres. Private reads and all durable writes must pass through server-side session and object/workspace authorization checks.
- Preview deployments must be protected before private learner notes, uploaded paper metadata, or production database branches exist. Prefer scrubbed/schema-only preview data once account work starts.
- Repository deploy tooling defaults to encrypted transports and refuses plain FTP.

## Content Rules

- Domain concept `content.mdx` is rendered as inert Markdown through
  `lib/safeMdx.ts`; do not execute content MDX as JavaScript.
- New `dangerouslySetInnerHTML` call sites require explicit sanitizer review
  and an allowlist update in `scripts/security-check.js`.
- External links opened in a new tab must use `rel="noopener noreferrer"`.
- The optional AI companion currently has a separate gateway under `gateway/ai-companion/`; long-term authenticated companion APIs should run server-side where learner session, workspace, rate limit, and database context are available.
- Files under `content/domains/**/content.mdx` are intentionally restricted to a safe markdown subset. Treat content changes as reviewed source changes, not arbitrary executable MDX.
