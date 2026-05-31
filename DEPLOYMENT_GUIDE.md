# Deployment Guide: Continuous Function

Continuous Function is moving from a static atlas into a logged-in learning and research platform. Production should therefore run on **Vercel** as a normal Next.js app. Static export remains available only for archival mirrors.

## Recommended Production Stack

- App host: Vercel
- Repository: `architrk/continiousfunction-private`
- Production branch: `main`
- Staging branch: `staging`
- Auth/orgs: Clerk
- Database: Neon Postgres
- Schema/migrations: Drizzle
- Realtime: none initially; Liveblocks later only for presence/shared focus/draft collaboration
- Storage: S3-compatible object storage later for paper uploads
- Server-side model calls: Next.js Pages API routes on Vercel first for authenticated bounded request/response calls; queue/worker path for long-running ingestion, OCR, embedding, and batch source-span jobs

See `content/_agent/PLATFORM_FOUNDATION.md` for the product and architecture rationale.
Use `content/_agent/DEPLOYMENT_HANDOFF.md` as the operational checklist when creating the Vercel, Clerk, and Neon accounts.

## Vercel Project Setup

Create a Vercel project from the private GitHub repo.

Use:

```txt
Framework preset: Next.js
Install command: npm ci
Build command: npm run build
Root directory: /
Production branch: main
```

Do not set `CF_STATIC_EXPORT=1` on Vercel. Account-backed platform features need normal Next.js server behavior.

`vercel.json` provides baseline production security headers. Once Clerk is installed, prefer Clerk middleware CSP handling or split route-specific CSPs instead of relying only on one static global header. If a future gateway, storage bucket, or third-party service is called directly from the browser, update `connect-src` there intentionally instead of allowing broad outbound connections.

## Environment Variables

Start from `.env.example`.

Production and Preview should have separate values where possible:

```bash
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
DATABASE_URL=
DATABASE_URL_UNPOOLED=
OPENAI_API_KEY=
```

Only `NEXT_PUBLIC_*` variables are browser-visible. Do not put provider secrets, database URLs, Clerk secret keys, OCR keys, or payment secrets in public variables.

Optional public gateway URLs while the old stateless gateways remain in use:

```bash
NEXT_PUBLIC_CF_AI_GATEWAY_URL=
NEXT_PUBLIC_CF_PAPER_MAPPER_GATEWAY_URL=
```

Long-term authenticated AI should start in server-side Vercel Pages API routes because those routes can see learner session, workspace, rate limits, and database state. Long-running ingestion, OCR, embedding, and source-span extraction should move to queued worker/gateway jobs.

## Cost Guardrails

The first production version should be intentionally small:

- Use Vercel Pro only when the app becomes a real production/commercial deployment; keep hard spend limits and alerts enabled.
- Start Clerk without B2B/administration add-ons. Keep organizations simple until teams are actually using shared workspaces.
- Start Neon on Free/Launch-style usage and set low autoscaling ceilings. Keep preview branches short-lived.
- Keep public atlas pages cacheable and mostly static so anonymous reading does not create unnecessary server/database load.
- Avoid `getServerSideProps`, middleware auth, database calls, or uncached API calls on anonymous atlas pages unless deliberately budgeted.
- Put AI calls behind authenticated server routes with per-user and per-workspace rate limits before enabling broad usage.
- Delay Liveblocks, Convex, dedicated search, image/video optimization add-ons, and paid storage products until one workflow proves it needs them.
- Do not enable Vercel Image Optimization for arbitrary user-uploaded or remote paper images without a transformation/cache budget.
- Use S3-compatible object storage, likely Cloudflare R2 or similar, for large paper/upload storage rather than defaulting to premium app-platform storage.

Cost rule: the platform should pay first for durable learner memory and source-grounded research workflows. Do not add a paid service just because it is elegant if a simpler Postgres/server route keeps the product moving.

## Clerk And Neon Setup

Create a Clerk application for identity and organizations.

Configure Clerk redirect URLs for:

```txt
http://localhost:3000/**
https://*.vercel.app/**
https://staging.continuousfunction.ai/**
https://continuousfunction.ai/**
```

Create a Neon Postgres project and configure:

```txt
DATABASE_URL          pooled runtime/serverless connection
DATABASE_URL_UNPOOLED direct migration/admin connection
```

Use Drizzle migrations for schema changes. The repo already has the first schema-only object-memory contract in `db/schema.ts` and `drizzle/0000_object_memory_contract.sql`; run `npm run validate:object-memory` before applying it anywhere. Clerk should own identity, sessions, profile UX, organizations, invites, and roles. Postgres should own learner route snapshots, object-attached notes, research threads, source-span metadata, AI run metadata, uploaded document metadata, and team/workspace permissions.

Do not query Postgres directly from the browser. Every durable write and private read must pass through server-side session checks and app-owned membership/object authorization helpers.

Clerk webhook handling must be idempotent:

- store received webhook event IDs
- process each event once
- mirror users, organizations, and memberships into Postgres rows
- keep a reconciliation script or admin path for missed events
- define deletion/export behavior before private notes and uploads launch

Neon preview data policy:

- protect preview deployments before private data exists
- keep preview branches short-lived
- do not expose copied production learner/upload data to unprotected previews
- prefer schema-only or scrubbed seed branches once private data exists
- use paid/protected production settings before real user data depends on Neon availability

## Static Mirror Contract

The static export is only an archival/public-atlas fallback.

`CF_STATIC_EXPORT=1` must not be expected to support:

- Clerk auth and middleware
- account dashboards
- API routes
- auth callbacks
- private uploads
- authenticated AI
- protected route-state sync

When account routes exist, the static build should exclude them, render clear static placeholders, or fail CI if server-only routes accidentally leak into the static mirror.

## Branch Model

```txt
main      -> production
staging   -> staging / account-integration testing
feature/* -> Vercel preview deployment
```

Protect `main`:

- require pull request before merge
- require CI
- block force pushes
- block deletion

Enable Vercel deployment protection for previews once account data exists.

## Checks Before Production Deploy

Run:

```bash
npm run validate-content
npm run verify:deployment-readiness
npm run typecheck
npm run lint
npm test -- --runInBand
npm run verify:ai-gateway
npm run verify:paper-gateway
npm run build
npm run audit:prod
```

After production is live:

```bash
npm run verify:production -- https://continuousfunction.ai/
```

`verify:production` checks status codes and hardened headers. If the CSP changes for Clerk, AI routes, or storage, update both `vercel.json` and the verifier expectations if needed.

## Rollback

Use Vercel's deployment history:

1. Open the Vercel project.
2. Select the last known-good production deployment.
3. Promote or rollback to that deployment.
4. Run `npm run verify:production -- https://continuousfunction.ai/`.
5. Revert or fix the bad commit before redeploying from `main`.

## Static Mirror / Hostinger Fallback

Static export is still available, but it is not the main production platform once login exists.

Build the static mirror:

```bash
npm run build:static
python3 -m http.server --directory out 3000
```

Deploy to Hostinger only as a fallback or archival mirror:

```bash
export CF_FTP_HOST="ftp.continuousfunction.ai"
export CF_FTP_PROTOCOL="ftps" # default; use "sftp" only if SSH/SFTP is enabled
export CF_FTP_USER="YOUR_USERNAME"
export CF_FTP_REMOTE_DIR="/your/remote/webroot"  # e.g. /public_html or ..
read -rsp "CF_FTP_PASS: " CF_FTP_PASS
echo
export CF_FTP_PASS

# Optional: also delete remote files that no longer exist locally.
export CF_FTP_DELETE=1

npm run deploy:hostinger
```

The Hostinger path uploads `out/` and relies on `public/.htaccess` for Apache headers. Vercel ignores `.htaccess`; production security headers live in `vercel.json`.

## Common Mistakes

| Mistake | Result | Fix |
| --- | --- | --- |
| Setting `CF_STATIC_EXPORT=1` on Vercel | Server/auth features disappear | Leave it unset for production |
| Putting `OPENAI_API_KEY` in `NEXT_PUBLIC_*` | Secret leaks into browser bundle | Use server-only env vars |
| Assuming `.htaccess` protects Vercel | Missing production headers | Use `vercel.json` |
| Building with the public repo | Wrong privacy model | Use `architrk/continiousfunction-private` |
| Adding global forum/community features first | Product loses the object-grounded learning loop | Attach notes/discussions to concepts, equations, papers, source spans, and demo states |
| Querying Postgres from the browser | Credential leak and authorization bypass | Route all durable reads/writes through server-side auth helpers |
| Copying production data into open previews | Private learner/upload data leak | Use protected previews and scrubbed/schema-only branches |
| Serving private PDFs through long Vercel requests | Storage cost plus function cost plus timeouts | Use object storage plus short signed access or queued processing |
