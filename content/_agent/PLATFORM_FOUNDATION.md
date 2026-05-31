# Continuous Function Platform Foundation

Created: 2026-05-05
Updated: 2026-05-05

## Decision

Continuous Function should move toward a Vercel-hosted full-stack Next.js platform with Clerk for identity, Neon Postgres for durable product data, and Drizzle for schema/migrations.

This is not the absolute cheapest possible stack. It is the best foundation for the next phase because it keeps the app close to the existing Next.js codebase, keeps core data portable in Postgres, avoids premature realtime complexity, and can stay inexpensive while usage is small.

Use:

- Vercel for the primary Next.js app, previews, production deployment, protected previews, and server-side routes.
- Clerk for authentication, session management, user profiles, organizations, invites, roles, and future team workspace UX.
- Neon Postgres for the canonical application database.
- Drizzle for TypeScript schema and reviewed SQL migrations.
- First-party Postgres tables for saved progress, notes, research threads, comments, evidence refs, permissions, AI runs, uploaded document metadata, and source spans.
- S3-compatible object storage later for private paper uploads and generated/fetched files.
- Liveblocks only later for realtime presence, inline comments, shared focus, or collaborative editing after the durable object model exists.
- Convex only as a contained future spike if realtime collaboration becomes the bottleneck after the object model is stable.

Do not start with Supabase unless we decide to consolidate the whole backend around Supabase Auth, Storage, Realtime, and Postgres. Do not make Convex the canonical foundation unless the product direction shifts toward realtime app state over relational evidence modeling.

## Cost And Operating Decision

As of 2026-05-05, the cost-aware choice is still Vercel + Clerk + Neon/Postgres + Drizzle.

Expected early monthly shape:

- Development / private previews: can usually stay near zero except AI API usage.
- First serious production launch: roughly Vercel Pro plus small Neon usage. Clerk can remain free until retained users or retained organizations exceed the included allowance.
- Collaboration phase: add paid realtime tooling only after object-attached notes, threads, route snapshots, and source-span references are already working in Postgres.
- Upload-heavy phase: use S3-compatible object storage, likely Cloudflare R2 or equivalent, for paper/PDF files rather than premium app-platform blob storage by default.

Cost controls to enforce:

- Keep anonymous atlas reading cacheable and static-like.
- Do not add auth/session checks, database reads, `getServerSideProps`, or uncached API calls to anonymous atlas pages unless deliberately budgeted.
- Require login before durable writes, AI memory, private uploads, or team workspaces.
- Rate-limit AI calls by user, workspace, and object.
- Set low Neon autoscaling limits at launch and let non-production branches scale to zero.
- Keep Neon preview branches short-lived.
- Use pooled Neon connections for runtime/serverless request traffic and unpooled direct connections for migrations/admin tasks.
- Turn on Vercel spend controls and alerts before public launch.
- Avoid Vercel Image Optimization and Blob for arbitrary user-uploaded or remote paper assets until there is a transformation, cache, storage, and data-transfer budget.
- Avoid Clerk paid B2B/administration add-ons until real team use requires them.
- Avoid Liveblocks, Convex, vector databases, and dedicated search until a workflow proves the need.

Why this is cost-rational:

- Vercel is not the cheapest edge compute provider, but it reduces migration and implementation risk for this existing Next.js app.
- Clerk is cheaper operationally than building auth/org/session UX now, even if it becomes a meaningful bill later.
- Neon keeps the canonical data model portable and lets us scale a relational database gradually.
- Drizzle keeps migrations reviewable without creating platform lock-in.
- Cloudflare remains the cost-efficient place for static mirrors, edge gateways, large egress-sensitive object storage, and possibly future Workers, but not the main full-stack app host for this phase.

Do not optimize prematurely for the cheapest theoretical infrastructure. Optimize for low fixed cost, explicit spending caps, a portable data model, and the ability to migrate individual layers without rebuilding the product.

## Product Constraint

Do not turn accounts into a generic community platform.

The durable product unit is an object-attached learning journey:

- paper
- equation
- source span
- concept
- code witness
- demo state
- learner prediction
- note
- discussion thread
- next action

Profiles, teams, notes, collaboration, and AI conversations should preserve these objects. They should not create a noisy feed that competes with the atlas.

## Why Vercel Now

The current site began as a static export. That was right for the atlas phase, but accounts need server behavior:

- session cookies
- protected routes
- profile pages
- saved progress
- user-specific dashboards
- authenticated AI calls
- database writes
- billing and team membership
- invite-only previews and staging

Static export cannot be the long-term production mode for that. Keep static rendering where it helps content performance, but let Vercel run the app as a normal Next.js deployment.

Cost caveat:

Vercel must be used with spend controls. Public anonymous pages should be cached aggressively, image/video-heavy features should be added deliberately, and AI calls should not run from unrestricted public routes.

## Static Mirror Contract

`CF_STATIC_EXPORT=1` exists only for public atlas archival output.

The static mirror must not pretend to support account-backed features. These are outside the static mirror:

- Clerk auth and middleware.
- `/me`, `/profile`, `/library`, `/workspace`, `/team`, `/research`, and other private account routes.
- API routes.
- Auth callbacks.
- Private uploads.
- Protected dashboards.
- Authenticated AI.
- Server-side route state sync.

Once account routes exist, the static build should either exclude them, render explicit "not available in static mirror" placeholders, or fail CI if server-only routes accidentally leak into the static export.

This protects the low-cost public fallback without constraining the real app into static-hosting limitations.

Near-term migration rule:

- Keep the existing `pages/` atlas routes working.
- Do not migrate the whole repo to App Router now.
- Add account/product surfaces incrementally under clearly scoped routes such as `/me`, `/profile`, `/library`, `/workspace`, `/team`, and `/research`.
- Keep `CF_STATIC_EXPORT=1` only for archival/static mirrors.
- Keep the public atlas fast and mostly static while the user/research overlay becomes dynamic.

## Why Clerk + Neon + Drizzle

Continuous Function's long-term data is evidence-linked and relational:

- users
- organizations
- memberships
- content object refs
- route snapshots
- demo observations
- notes
- research threads
- comments
- evidence refs
- AI runs
- uploaded documents
- source spans
- permissioned retrieval
- analytics and exports

Postgres is the natural canonical store for this. Drizzle keeps schema changes explicit and reviewable. Neon fits Vercel previews and database branching well enough for account/platform work.

Clerk should own identity and organizations. The app should own the learning/research data.

Cost caveat:

Do not make Clerk Organizations the center of the product on day one. Start with personal learner memory and only introduce teams when shared paper/concept/research workspaces are real. This avoids paying for B2B features before the learning loop justifies them.

## Why Not Supabase As Foundation

Supabase is viable if we go all-in on Supabase Auth, Postgres, RLS, Realtime, Storage, and Edge Functions.

Do not mix it as a half-foundation with Clerk unless there is a very specific reason. Clerk plus Supabase creates duplicated identity and permission machinery. If Clerk owns identity and organizations, the canonical app database should be plain Postgres with explicit server-side authorization, not a second auth/RLS model fighting it.

## Why Not Convex As Primary Foundation

Convex is genuinely attractive:

- reactive queries by default
- Clerk integration
- Vercel deploy integration
- file storage
- scheduled functions
- vector search
- fast product iteration for live state

It is likely better than Supabase for a first realtime prototype. It is not the best canonical foundation for this product's durable model.

The risk is not that Convex cannot model relationships. It can. The risk is that the core product needs relational source grounding, permissioned retrieval, SQL-style audits, migrations, exports, and analytics. A document/reactive backend could make the early app feel alive while making the evidence graph harder to query and govern later.

Allowed Convex spike later:

```txt
Goal:
  Test whether Convex materially improves live object boards or route-snapshot sync.

Allowed:
  Prototype-only live route board or research-thread sidebar.

Not allowed:
  Primary users table
  Primary organization permissions
  Uploaded document metadata
  Source spans
  AI retrieval memory
  Canonical notes/comments/evidence refs
```

Adoption criterion:

Only revisit Convex if realtime collaboration becomes the near-term bottleneck and Postgres + Liveblocks feels too heavy after the durable object model is working.

Cost caveat:

Convex may be cheap and fast for early realtime prototypes, but it adds another platform and another data model. That extra operating surface is only worth it if realtime behavior is the bottleneck. Until then, one canonical Postgres model is cheaper to reason about and cheaper to migrate.

## Auth Model

Start with Clerk.

Application tables should use internal IDs:

```txt
users.id
users.clerk_user_id
organizations.id
organizations.clerk_org_id
memberships.user_id
memberships.org_id
memberships.role
```

Do not key saved progress, notes, research threads, or AI runs directly by Clerk IDs. Mirror Clerk users and organizations into app-owned rows through webhooks.

Auth policy:

- No login required for reading the atlas.
- No login required for local-only demo exploration.
- Login required for cross-device saved progress, research notes, team workspaces, private paper uploads, and private AI memory.
- Anonymous local route snapshots should be importable after login.

Do not launch public social profiles first. Start with private learner profiles: saved routes, preferences, notes, progress, recent objects, and team memberships.

## Authorization Boundary

Clerk authenticates. Postgres authorizes product data through app-owned users, organizations, memberships, roles, visibility fields, and object/workspace permissions.

Rules:

- No browser-to-database access.
- Every durable write goes through a server-side route with session verification.
- Every object query checks user/workspace membership and visibility.
- Server routes should use shared helpers such as `requireUser`, `requireWorkspaceRole`, `canReadObject`, `canWriteObject`, and `canUseAIForObject`.
- Clerk webhooks must be idempotent. Store webhook event IDs, process them once, and keep a reconciliation path for missed user/org/membership events.
- Account deletion, org removal, and workspace departure need explicit retention/deletion policy before private notes and uploads are enabled.

## Core Data Model

The repo remains canonical for published atlas content. Postgres stores the user, team, collaboration, upload, and AI overlay.

Initial tables:

- `users`
- `organizations`
- `memberships`
- `webhook_events`
- `content_object_refs`
- `learning_route_snapshots`
- `learning_observations`
- `research_notes`
- `research_threads`
- `research_comments`
- `evidence_refs`
- `ai_runs`
- `uploaded_documents`
- `document_spans`

`uploaded_documents` and `document_spans` should preserve integrity metadata such as document hash, parser version, page/line/character offsets where available, extraction confidence, and source-processing consent.

Every saved item should answer:

1. What object is this attached to?
2. What claim, equation, demo state, or source span does it preserve?
3. Who can see it?
4. What is the next useful action?
5. Can an AI tutor use it without inventing context?

Use stable typed object keys:

```txt
concept:attention-transformers/rope
equation:attention-transformers/rope#relative-phase-dot-product
code:optimization/adam#bias-correction-witness
demo:llm-systems/llm-serving#ttft-tpot-lab
source-span:attention-transformers/flash-attention#dao-2022-online-softmax
paper:arxiv:2205.14135#section-3
route:attention-serving#kv-cache-checkpoint
```

Do not use URL alone as identity. URLs move; object keys should survive route renames.

Store relational fields for what we query. Use JSON only for compact measured state and AI/source manifests, not for ownership, permissions, object identity, or source refs.

Current repo state:

- `npm run generate-object-manifest` writes `content/_generated/content-object-manifest.json`.
- The manifest currently inventories concepts, concept routes, product routes, live demos, extracted equation spans, code witnesses, source cards, source-note spans, claim checks, central claims, and likely misconception objects.
- `npm run validate-content` treats the manifest as a blocking contract: stale or unexpected generated keys, missing current keys, unsupported claim object refs, and dangling claim object refs fail validation.
- Reading-room and local route snapshot objects can now carry `objectKey` while keeping `discussionAnchorId` as the UI/resume anchor.
- `ResearchReadingRoom` now includes a browser-local action journal keyed only by `ContentObjectKey`, stored under `cf:object-action-journal`, for one bounded draft note plus one next action per selected object. This is intentionally local to the browser and is not account-synced or collaborative memory.
- `object-memory-contract-v1` adds `db/schema.ts`, `drizzle/0000_object_memory_contract.sql`, mapper contracts, and `npm run validate:object-memory` so manifest objects and local route snapshots can map into durable Postgres rows without any live database connection.
- `/me` now exposes a contract-only Study Memory preview for the current browser-local `LearningRouteSnapshot`, and `POST /api/me/learning-route-snapshots` validates the same snapshot server-side before preparing DB-shaped insert packets. The route returns `persisted=false` until real auth/database adapters exist.
- `resolveAccountMemoryAuth` defines the app-owned account-memory identity boundary. It can use a local dev `users.id` UUID for contract checks, recognizes that a Clerk session still needs app-user mirroring, and never treats a Clerk `user_...` id as `owner_user_id`.
- The repo still has no Neon database client, Clerk runtime, protected account route, executed migrations, or live persisted account-memory writes.

## Collaboration Model

Start asynchronous and object-attached.

Phase 1:

- Save learner route state to Postgres.
- Promote the current local route snapshot into `learning_route_snapshots` and `learning_observations`.
- Save object-specific notes and research threads.
- Add shareable workspace links for a paper, equation, concept, route, or demo observation.
- Add comments only on research objects, not global discussion pages.

Phase 2:

- Add team workspaces, roles, and invite flows through Clerk Organizations mirrored into Postgres.
- Add object boards, not feeds:
  - unresolved source checks
  - open misconceptions
  - saved route questions
  - demo observations needing explanation
  - shared paper-to-concept routes

Phase 3:

- Add Liveblocks only after the Postgres object model is enforced.
- Use it for specialized presence, cursor/focus, inline comments, collaborative drafting, or whiteboard/editor surfaces.

Concrete rule:

```txt
Postgres owns:
- notes
- threads
- comments
- permissions
- evidence refs
- resolution state
- saved route state
- AI run state
- document/source-span metadata

Liveblocks may later own:
- live cursor/focus
- draft co-editing state
- transient room state
```

A realtime room should never exist without a corresponding object key or route key.

## AI And Privacy Boundaries

The AI layer should become account-aware only after the data model is source-grounded.

Rules:

- Never expose provider secrets in `NEXT_PUBLIC_*`.
- Treat learner text, notes, paper uploads, and AI questions as private user content.
- Store AI conversation records by object and workspace, not as one global chat log.
- Do not log full prompts by default.
- Persist compact summaries and source ids before persisting long transcripts.
- Send selected object context, not the learner's whole profile.
- Keep public atlas retrieval and private learner/team retrieval separate.
- AI output can become a user note or draft explanation; it cannot silently become canonical atlas content.
- Uploaded PDFs and OCR should have explicit disclosure before third-party processing.

Long-term authenticated AI APIs should start as server-side Next.js Pages API routes on Vercel for bounded request/response work because they need session, workspace, rate-limit, and database context.

Long-running PDF parsing, OCR, embeddings, batch source-span extraction, or expensive AI workflows should enqueue work to a worker/gateway/job system and persist status in Postgres. Do not hide long-running ingestion inside request/response routes.

## Deployment Foundation

Production:

- Vercel project connected to `architrk/continiousfunction-private`.
- Production branch: `main`.
- Preview deployments for pull requests.
- Deployment protection on previews.
- Environment variables scoped by Production, Preview, and Development.

Branches:

- `main`: production.
- `staging`: staging and account-integration tests.
- feature branches: preview only.

Required account setup:

- Vercel project.
- Clerk application.
- Neon Postgres project.
- GitHub private repo access from Vercel.
- Production domain later.

Preview data policy:

- Use deployment protection for previews before private learner data exists.
- Keep Neon preview branches short-lived.
- Do not create unprotected preview branches from production private learner/upload data.
- Prefer schema-only or scrubbed seed branches for account-work previews once private data exists.
- Protect the production Neon branch, choose a region close to Vercel, set autoscaling ceilings, and decide explicitly whether scale-to-zero latency is acceptable for logged-in surfaces.

Required environment variables:

```bash
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
DATABASE_URL=
DATABASE_URL_UNPOOLED=
OPENAI_API_KEY=
```

Only `NEXT_PUBLIC_*` values are browser-visible. Everything else must stay server-side.

## First Repo Changes

1. Add this platform foundation document and make future account work follow it.
2. Keep `next.config.mjs` dynamic-capable for Vercel and static export behind `CF_STATIC_EXPORT=1`.
3. Update deployment docs for Vercel + Clerk + Neon + Drizzle.
4. Add `.env.example` for Vercel, Clerk, Neon, and OpenAI without secrets.
5. Add first Drizzle schema/migration for users, organizations, memberships, route snapshots, observations, object notes, research threads, comments, evidence refs, uploads, and AI runs. Done as `object-memory-contract-v1`: schema, reviewed SQL, mappers, validator, and tests only. Keep real Neon migration execution, database client wiring, auth helpers, and write paths for the next account-memory slice.
6. Add an object-key manifest generator before saving collaborative data. Done in `content-object-manifest-spine`; keep it current before Drizzle/account work.

Do not implement billing before saved learner memory exists. Billing tiers should gate durable platform value, not access to half-formed community features.

## Account Creation Checklist For The User

Create these when ready:

1. Vercel account/project connected to `architrk/continiousfunction-private`.
2. Clerk application for Continuous Function.
3. Neon Postgres project for Continuous Function.
4. Clerk auth redirect URLs for local, preview, staging, and production.
5. Neon pooled and unpooled connection strings.
6. OpenAI project/API key for server-side companion APIs.

Cost setup checklist:

1. Set Vercel spend limits and alerts before linking the production domain.
2. Start Neon with conservative autoscaling and branch-expiration rules.
3. Leave Clerk add-ons disabled unless the selected feature is required in production.
4. Put AI endpoints behind authentication and rate limits before real users use them.
5. Keep static mirror deployment available as a low-cost fallback for the public atlas.
6. Use pooled `DATABASE_URL` for runtime traffic and `DATABASE_URL_UNPOOLED` for Drizzle migrations/admin work.
7. Keep public atlas routes free of Clerk, database, and dynamic rendering unless intentionally budgeted.

After those exist, the repo can wire real auth, protected dashboard routes, mirrored user/org rows, and persistent learning observations.

## Research Sources To Keep Checking

- Next.js authentication and data-access guidance: https://nextjs.org/docs/app/guides/authentication
- Next.js static export constraints: https://nextjs.org/docs/pages/guides/static-exports
- Vercel deployment and environment docs: https://vercel.com/docs
- Clerk Next.js Pages Router quickstart: https://clerk.com/docs/getting-started/quickstart/pages-router
- Clerk organizations: https://clerk.com/docs/organizations/overview
- Clerk CSP guidance: https://clerk.com/docs/guides/secure/best-practices/csp-headers
- Neon with Vercel: https://neon.com/docs/guides/vercel-overview
- Neon pricing: https://neon.com/pricing
- Neon production checklist: https://neon.com/docs/get-started/production-checklist
- Neon connection type guidance: https://neon.com/docs/connect/choose-connection
- Drizzle migrations: https://orm.drizzle.team/docs/migrations
- Liveblocks collaboration docs: https://liveblocks.io/docs
- Liveblocks pricing: https://liveblocks.io/pricing
- Clerk pricing: https://clerk.com/pricing
- Vercel pricing: https://vercel.com/pricing
- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Convex realtime: https://docs.convex.dev/realtime
- Convex Vercel deployment: https://docs.convex.dev/production/hosting/vercel
- Convex pricing: https://www.convex.dev/pricing
