# Object Memory Contract

This folder defines the first durable database contract for Continuous Function's logged-in learner and research overlay.

The public atlas remains repo-owned. Postgres stores private or organization-visible memory that attaches back to canonical content objects by `object_key`, never by URL alone.

This slice includes the first deterministic persistence handoff, while keeping live account memory disabled until app-owned identity and Neon/Drizzle execution are deliberately connected.

- no database client
- no `DATABASE_URL` access
- no Clerk runtime
- no direct persistence execution
- no browser-to-database access
- no migration execution against Neon
- contract-only API responses with `persisted=false`
- dev-owner path only prepares a not-executed handoff through `CF_DEV_ACCOUNT_MEMORY_OWNER_ID`

## Contract

`content_object_refs` is seedable from `content/_generated/content-object-manifest.json`. Learner snapshots, observations, notes, threads, evidence, AI runs, uploads, and document spans reference those keys.

`learning_route_snapshots.route_snapshot_dedupe_key` and `learning_observations.observation_dedupe_key` are deterministic idempotency keys for future upserts. Route snapshots also carry `snapshot_content_hash`; observations carry `measured_state_hash`, optional `workbench_state_hash`, and the parent `route_snapshot_dedupe_key`. Repeated saves of the same route or exact observation should not duplicate private learner memory, while a changed workbench measurement can still become a new observation.

Identity and authorization fields stay relational:

- app-owned `users.id` and `organizations.id`
- `memberships.role`
- `owner_user_id`
- `organization_id`
- `visibility`
- `object_key`

JSONB is allowed only for compact structured state that already exists as repo contracts: route snapshots, restorable workbench state, measured demo state, evidence locators, AI metadata, and document parser metadata.

Uploaded documents and document spans are still inert metadata contracts. A durable uploaded paper must have a `paper:` object key, and durable extracted spans must have `source-span:` object keys before future upload/storage code can reference them.

`updated_at` defaults to `now()` in the schema. Future server-side write helpers are responsible for setting it on updates; this slice does not add triggers or runtime writes.

## Migration Use

`npm run db:generate` uses Drizzle Kit to generate SQL from `db/schema.ts` into `drizzle/`.

Do not run migrations against Neon until a real database exists and `DATABASE_URL_UNPOOLED` is configured outside the repo. Runtime serverless traffic should eventually use pooled `DATABASE_URL`; migration/admin commands should use the unpooled direct string.

The current API only prepares a persistence handoff when the request resolves to an app-owned user, currently via the local development owner env. Clerk sessions still return a mirror-required state until webhook-backed app-owned users are connected.

## Validation

Run:

```bash
npm run validate:object-memory
```

The validator checks the committed migration, required tables, object-key indexes, idempotent dedupe keys, ownership fields, manifest-to-row mapping, route snapshot mapping, and the no-runtime-persistence boundary for this slice.
