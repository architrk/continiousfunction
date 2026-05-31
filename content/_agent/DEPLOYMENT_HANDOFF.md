# Continuous Function Deployment Handoff

Updated: 2026-05-05

## Current Status

The repo is deployment-ready for a first Vercel project import, but it is not live yet.

- Source directory: `/Users/architkhare/Library/Mobile Documents/com~apple~CloudDocs/Repos/continiousfunction`
- Private GitHub repo: `architrk/continiousfunction-private`
- Working branch: `private/research-learning-loop-20260505`
- Confirm latest pushed commit with `git log -1 --oneline --decorate`.
- Primary host decision: Vercel full-stack Next.js
- Static fallback: `CF_STATIC_EXPORT=1` archival mirror only

Do not deploy from the public repo. Use the private repo unless the user explicitly changes the privacy model.

## What Is Already Done In The Repo

- `next.config.mjs` supports normal Vercel `next build` by default.
- `CF_STATIC_EXPORT=1` enables static export for Hostinger/archive mirrors.
- `vercel.json` defines baseline production headers.
- `.env.example` lists the first required Vercel, Clerk, Neon, and OpenAI variables.
- `DEPLOYMENT_GUIDE.md` documents the Vercel deployment path and static mirror fallback.
- `content/_agent/PLATFORM_FOUNDATION.md` documents the cost-aware platform decision.
- `db/schema.ts`, `drizzle/0000_object_memory_contract.sql`, and `npm run validate:object-memory` define the repo-only object-memory Postgres contract for content object refs, learner snapshots/observations, notes, threads, comments, evidence refs, AI run metadata, uploaded document metadata, and source spans.
- `npm run verify:deployment-readiness` checks that local deployment metadata still points at the private repo and Vercel path, then runs the object-memory contract validator.
- `responses/cf-platform-cost-foundation-review-20260505.md` stores the Oracle/GPT Pro architecture review.

Verified locally before this handoff:

```bash
npm run validate-content
npm run verify:deployment-readiness
npm run typecheck
npm run lint
CF_NEXT_BUILD_CPUS=1 npm run build
CF_NEXT_BUILD_CPUS=1 npm run build:static
```

Known non-blocking warnings:

- Existing Next lint warnings for raw `<img>` usage.
- Existing KaTeX `newLineInDisplayMode` warnings during build.

## Needs User Account/API Work

The next deployment step needs account setup outside the repo.

Create or approve:

1. Vercel project imported from `architrk/continiousfunction-private`.
2. Clerk application for Continuous Function.
3. Neon Postgres project.
4. OpenAI project/API key for server-side AI routes when those are enabled.
5. Domain decision for first launch:
   - preview/staging first, or
   - production domain `continuousfunction.ai`.

## Vercel Import Settings

Use:

```txt
Framework preset: Next.js
Install command: npm ci
Build command: npm run build
Root directory: /
Production branch: main
```

Do not set `CF_STATIC_EXPORT=1` in Vercel.

For a first preview before merging:

```txt
Branch: private/research-learning-loop-20260505
Environment: Preview
```

For production:

```txt
Branch: main
Environment: Production
```

## Environment Variables

Start with these:

```bash
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
DATABASE_URL=
DATABASE_URL_UNPOOLED=
OPENAI_API_KEY=
```

Optional while the existing gateway Workers remain browser-called:

```bash
NEXT_PUBLIC_CF_AI_GATEWAY_URL=
NEXT_PUBLIC_CF_PAPER_MAPPER_GATEWAY_URL=
```

Rules:

- Only `NEXT_PUBLIC_*` values may be browser-visible.
- Use pooled `DATABASE_URL` for runtime/serverless traffic.
- Use direct/unpooled `DATABASE_URL_UNPOOLED` for Drizzle migrations/admin tasks.
- Production and Preview should use separate values once private learner data exists.

## Cost Guardrails Before Public Launch

- Enable Vercel spend alerts/limits before the production domain goes live.
- Keep public atlas routes static/cacheable and free of Clerk/database reads.
- Start Clerk without paid B2B add-ons unless real team workspaces require them.
- Set conservative Neon autoscaling limits and short preview branch retention.
- Do not serve private PDFs through long Vercel request handlers.
- Prefer Cloudflare R2 or another S3-compatible store for large private uploads later.
- Keep Liveblocks and Convex deferred until realtime rooms are tied to stable object keys.

## Security Gates Before Real Learner Data

- Vercel preview deployments protected.
- `main` protected in GitHub.
- Production deploys from private repo only.
- Clerk development instance not used for production.
- No browser-to-Postgres access.
- Server-side authorization helpers exist before durable writes.
- Clerk webhook idempotency exists before user/org mirroring.
- Neon preview branches do not expose production learner/upload data.

## First Deployment Sequence

1. Import the private repo into Vercel.
2. Deploy `private/research-learning-loop-20260505` as a preview.
3. Verify the preview build succeeds with no `CF_STATIC_EXPORT`.
4. Run local and remote deployment checks:

```bash
npm run verify:deployment-readiness
npm run verify:production -- https://<preview-url>/
```

5. Create Clerk and Neon only when moving from public atlas preview to account work.
6. Add env vars to Vercel Preview first.
7. Implement the account skeleton from `content/_agent/TODO.yaml`.
8. Merge to `main` only after preview deploy, auth, database, and security gates pass.

## Do Not Lose Track

The next repo task after Vercel import is not billing. It is the account memory skeleton:

- Clerk provider and middleware.
- Protected `/me` or `/profile` route. Current `/me` is a public contract-only preview and must be protected before real account memory ships.
- Run the committed Drizzle migration against Neon after `DATABASE_URL_UNPOOLED` exists.
- `users`, `organizations`, `memberships`, and `webhook_events`.
- Server-side authorization helpers. Current `resolveAccountMemoryAuth` is only the first account-memory identity boundary: it expects app-owned UUIDs and refuses to use Clerk IDs as learner-memory owners.
- Replace contract-only `POST /api/me/learning-route-snapshots` with a Clerk-authenticated, app-owned-user, Drizzle-backed write path for saved route observations.

Billing should wait until saved learner memory is useful enough to justify returning.
