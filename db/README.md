# Object Memory Contract

This folder defines the first durable database contract for Continuous Function's logged-in learner and research overlay.

The public atlas remains repo-owned. Postgres stores private or organization-visible memory that attaches back to canonical content objects by `object_key`, never by URL alone.

This slice is intentionally schema-only:

- no database client
- no `DATABASE_URL` import
- no Clerk runtime
- no API routes
- no browser-to-database access
- no migration execution against Neon

## Contract

`content_object_refs` is seedable from `content/_generated/content-object-manifest.json`. Learner snapshots, observations, notes, threads, evidence, AI runs, uploads, and document spans reference those keys.

Identity and authorization fields stay relational:

- app-owned `users.id` and `organizations.id`
- `memberships.role`
- `owner_user_id`
- `organization_id`
- `visibility`
- `object_key`

JSONB is allowed only for compact structured state that already exists as repo contracts: route snapshots, measured demo state, evidence locators, AI metadata, and document parser metadata.

Uploaded documents and document spans are still inert metadata contracts. A durable uploaded paper must have a `paper:` object key, and durable extracted spans must have `source-span:` object keys before future upload/storage code can reference them.

`updated_at` defaults to `now()` in the schema. Future server-side write helpers are responsible for setting it on updates; this slice does not add triggers or runtime writes.

## Migration Use

`npm run db:generate` uses Drizzle Kit to generate SQL from `db/schema.ts` into `drizzle/`.

Do not run migrations against Neon until a real database exists and `DATABASE_URL_UNPOOLED` is configured outside the repo. Runtime serverless traffic should eventually use pooled `DATABASE_URL`; migration/admin commands should use the unpooled direct string.

## Validation

Run:

```bash
npm run validate:object-memory
```

The validator checks the committed migration, required tables, object-key indexes, ownership fields, manifest-to-row mapping, route snapshot mapping, and the no-runtime-surface boundary for this slice.
