import fs from 'node:fs'

import {
  objectAttachedMemoryTables,
  ownerScopedMemoryTables,
  requiredObjectMemoryTables,
} from './objectMemoryTypes'

const migration = fs.readFileSync('drizzle/0000_object_memory_contract.sql', 'utf8')

function tableBlock(table: string) {
  const start = migration.indexOf(`CREATE TABLE "${table}"`)
  const rest = migration.slice(start)
  const end = rest.indexOf(');')
  return rest.slice(0, end)
}

describe('object memory SQL contract', () => {
  it('creates the required durable object-memory tables', () => {
    for (const table of requiredObjectMemoryTables) {
      expect(migration).toContain(`CREATE TABLE "${table}"`)
    }
  })

  it('keeps object-attached rows keyed by object_key instead of URL identity', () => {
    for (const table of objectAttachedMemoryTables) {
      expect(tableBlock(table)).toContain('"object_key"')
    }

    expect(tableBlock('content_object_refs')).toContain('"object_key" text PRIMARY KEY NOT NULL')
    expect(tableBlock('content_object_refs')).toContain("!~ '://'")
    expect(tableBlock('content_object_refs')).toContain('split_part("content_object_refs"."object_key", \':\', 1) = "content_object_refs"."object_type"::text')
    expect(tableBlock('content_object_refs')).toContain('"href" text')
    expect(tableBlock('content_object_refs')).not.toContain('"href" text PRIMARY KEY')
    expect(tableBlock('uploaded_documents')).toContain('"object_key" text NOT NULL')
    expect(tableBlock('document_spans')).toContain('"object_key" text NOT NULL')
    expect(tableBlock('document_spans')).toContain("like 'source-span:%'")
  })

  it('requires app-owned user ownership for durable learner rows', () => {
    for (const table of ownerScopedMemoryTables) {
      expect(tableBlock(table)).toContain('"owner_user_id" uuid NOT NULL')
    }

    expect(tableBlock('users')).toContain('"id" uuid PRIMARY KEY')
    expect(tableBlock('users')).toContain('"clerk_user_id" text')
    expect(tableBlock('users')).not.toContain('"clerk_user_id" text PRIMARY KEY')
  })

  it('requires organization ids whenever visibility is organization-scoped', () => {
    for (const table of ['learning_route_snapshots', 'research_notes', 'research_threads', 'uploaded_documents']) {
      expect(tableBlock(table)).toContain(`"${table}"."visibility" = 'private' or "${table}"."organization_id" is not null`)
    }
  })

  it('requires route snapshots to keep a route object anchor', () => {
    expect(tableBlock('learning_route_snapshots')).toContain('"route_object_key" text NOT NULL')
    expect(tableBlock('learning_route_snapshots')).toContain('"route_snapshot_dedupe_key" text NOT NULL')
    expect(tableBlock('learning_route_snapshots')).toContain('"snapshot_content_hash" text NOT NULL')
    expect(tableBlock('learning_route_snapshots')).toContain("like 'route:%'")
    expect(migration).toContain('CREATE INDEX "learning_route_snapshots_route_object_idx"')
    expect(migration).toContain('CREATE UNIQUE INDEX "learning_route_snapshots_owner_dedupe_unique"')
    expect(migration).toContain('learning_route_snapshots_route_object_key_content_object_refs_object_key_fk')
  })

  it('keeps workbench restore state explicit on durable learning observations', () => {
    expect(tableBlock('learning_observations')).toContain('"observation_dedupe_key" text NOT NULL')
    expect(tableBlock('learning_observations')).toContain('"measured_state_hash" text NOT NULL')
    expect(tableBlock('learning_observations')).toContain('"workbench_state_hash" text')
    expect(migration).toContain('CREATE UNIQUE INDEX "learning_observations_owner_dedupe_unique"')
    expect(tableBlock('learning_observations')).toContain('"workbench_state" jsonb')
    expect(tableBlock('learning_observations')).toContain('learning_observations_workbench_state_size')
    expect(tableBlock('learning_observations')).toContain('"measured_state" jsonb')
  })

  it('limits the schema slice to migration DDL, not runtime env or auth surfaces', () => {
    expect(migration).toContain('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    expect(migration).not.toContain('DATABASE_URL')
    expect(migration).not.toContain('NEXT_PUBLIC_DATABASE_URL')
    expect(migration).not.toContain('process.env')
  })
})
