## Recommended next slice

Implement **option 1: a pure persistence handoff object**, but make **option 2’s deterministic idempotency/dedupe keys part of that handoff**.

So the slice is:

> Add a contract-only `AccountLearnerMemoryPersistenceHandoff` that says: “this validated snapshot would produce these exact future DB write operations, with these object attachments, dependency order, conflict keys, and hashes — but no write has executed.”

Do **not** wire Drizzle, Neon, or Clerk runtime clients yet.

This should replace or wrap the current top-level `inserts` field. Right now `inserts` is useful, but it is too close to “ready to execute.” The next abstraction should make the missing execution boundary explicit.

---

## Why this is the right level of abstraction now

The current server planner already does the important first half:

```txt
unknown candidate
-> validate cf-route-snapshot-v1
-> build preview
-> derive DB-shaped rows
-> project workbench restore
-> persisted=false
```

The missing correctness layer is not “how do we write to Neon?” yet. It is:

```txt
what exact durable memory operation would be safe to run later?
```

That means you need to define:

```txt
validated import plan
-> deterministic write identities
-> object attachment resolution
-> dependency order
-> conflict/upsert semantics
-> not executed
```

This gives you persistence readiness without pretending persistence exists.

The especially important thing: **idempotency has to be designed before the first durable write**. If you add real writes first, repeated local saves can create duplicate route snapshots, duplicate observations, or worse, overwrite the wrong learner object. Account-backed memory corruption usually starts from vague write identity, not from SQL mechanics.

So the recommended slice is really:

```txt
pure handoff + dedupe keys + exact attachment contract
```

Not a DB client.

---

## Evaluation of the options

### 1. Add a pure persistence handoff object

**Yes. This is the best next slice.**

But it must not be a decorative wrapper around `inserts`. It should describe future write execution explicitly:

```txt
operation kind
table
row payload
dedupe key
content hash
conflict target
dependency on prior operation
resolved object attachment
execution status: not-executed
```

This keeps the API honest while giving the future persistence adapter an exact contract to implement.

### 2. Add idempotency/dedupe keys

**Also yes, but as part of option 1.**

This is the highest-impact correctness detail. Repeated browser-local saves are normal. Future account memory must be able to safely receive the same snapshot more than once.

You need two different concepts:

```txt
route snapshot identity key:
  same logical route memory; later saves update the latest route state

route snapshot content hash:
  exact version of the snapshot payload

observation dedupe key:
  same learner observation; repeated saves should not duplicate evidence

observation measured/workbench hash:
  exact observation/workbench payload integrity
```

Do not use a single “hash the whole snapshot” key for everything. That either creates duplicates on every small change or collapses distinct observations incorrectly.

### 3. Add a local/dev-only write readiness adapter around `CF_DEV_ACCOUNT_MEMORY_OWNER_ID`

**Not yet.**

A dev owner can help test readiness, but an adapter creates the psychological shape of persistence before the write contract is safe.

Use the dev owner only to produce a `write-ready` handoff. Do not add a pretend local write layer. That would train the API/UI to act as if account memory exists.

### 4. Start wiring Drizzle runtime client and update validator

**No. Premature.**

Real writes before deterministic keys, conflict semantics, and dependency resolution would be the most likely path to corrupt learner memory.

You would also be importing runtime infrastructure into an API that is currently explicitly contract-only. That violates the current trust boundary.

### 5. Improve the `/me` UI copy only

**Useful, but not enough.**

UI copy can reduce confusion, but it does not improve persistence correctness. It should follow the handoff work, not replace it.

---

## Exact contract fields that should exist

Add a new handoff object. Something like this:

```ts
export const accountLearnerMemoryPersistenceHandoffVersion =
  'cf-account-learner-memory-persistence-handoff-v1' as const

export const accountLearnerMemoryDedupeKeyVersion =
  'cf-account-learner-memory-dedupe-v1' as const

export type AccountLearnerMemoryPersistenceHandoff = {
  version: typeof accountLearnerMemoryPersistenceHandoffVersion
  dedupeKeyVersion: typeof accountLearnerMemoryDedupeKeyVersion

  serverMode: 'contract-only'
  persisted: false

  execution: {
    status: 'not-executed'
    reason: 'persistence-runtime-adapter-not-connected'
  }

  ownership: {
    ownerUserId: string
    organizationId: string | null
    visibility: 'private' | 'organization'
  }

  sourceSnapshot: {
    snapshotVersion: LearningRouteSnapshot['version']
    source: LearningRouteSnapshot['source']
    mappingId: string
    routeObjectKey: ContentObjectKey
    currentObjectKey: ContentObjectKey | null
    snapshotContentHash: string
  }

  routeSnapshot: {
    table: 'learning_route_snapshots'
    operation: 'upsert-latest-route-state'

    dedupeKey: string
    contentHash: string

    conflictTarget: readonly [
      'owner_user_id',
      'route_snapshot_dedupe_key',
    ]

    row: LearningRouteSnapshotInsert
  }

  observation?: {
    table: 'learning_observations'
    operation: 'insert-if-absent'

    dedupeKey: string
    measuredStateHash: string
    workbenchStateHash: string | null

    conflictTarget: readonly [
      'owner_user_id',
      'observation_dedupe_key',
    ]

    dependsOn: {
      table: 'learning_route_snapshots'
      dedupeKey: string
      snapshotIdResolution: 'resolve-after-route-snapshot-upsert'
    }

    attachment: {
      objectKey: ContentObjectKey
      resolution:
        | 'typed-workbench-equation-object'
        | 'snapshot-current-object'
      currentObjectKey: ContentObjectKey | null
      workbenchEquationObjectKey: ContentObjectKey | null
    }

    row: LearningObservationInsert
  }
}
```

Then change the import result shape from this:

```ts
inserts?: {
  routeSnapshot: LearningRouteSnapshotInsert
  observation?: LearningObservationInsert
}
```

to this:

```ts
persistenceHandoff?: AccountLearnerMemoryPersistenceHandoff
```

or, during transition:

```ts
persistenceHandoff?: AccountLearnerMemoryPersistenceHandoff
/** @deprecated use persistenceHandoff.routeSnapshot.row */
inserts?: {
  routeSnapshot: LearningRouteSnapshotInsert
  observation?: LearningObservationInsert
}
```

But I would prefer removing top-level `inserts` from the public API response. Keep rows inside the handoff.

---

## Fields to add to the DB-shaped insert contracts

Update `LearningRouteSnapshotInsert`:

```ts
export type LearningRouteSnapshotInsert = ObjectMemoryOwnership & {
  routeSnapshotDedupeKey: string
  snapshotContentHash: string

  source: LearningRouteSnapshot['source']
  mappingId: string
  paperTitle: string
  inputKind: string
  routeObjectKey: ContentObjectKey
  currentObjectKey?: ContentObjectKey | null
  currentQuestion?: string | null
  routeConceptIds: readonly string[]
  routeLabels: readonly string[]
  routeConcepts?: LearningRouteSnapshot['routeConcepts'] | null
  sourceObjects?: readonly LearningRouteSourceObject[] | null
  graphRoute?: LearningRouteSnapshot['graphRoute'] | null
  routeProgress?: LearningRouteSnapshot['routeProgress'] | null
  primaryEquation?: LearningRouteSnapshot['primaryEquation'] | null
  snapshotJson: LearningRouteSnapshot
}
```

Update `LearningObservationInsert`:

```ts
export type LearningObservationInsert = {
  ownerUserId: string
  organizationId?: string | null

  observationDedupeKey: string
  measuredStateHash: string
  workbenchStateHash?: string | null
  routeSnapshotDedupeKey?: string | null

  snapshotId?: string | null
  objectKey: ContentObjectKey
  observationSource: NonNullable<LearningRouteSnapshot['lastObservation']>['source']
  observationKind: NonNullable<LearningRouteSnapshot['lastObservation']>['kind'] | 'route-state'
  label: string
  value: string
  detail?: string | null
  nextQuestion?: string | null
  workbenchState?: LearningObservationWorkbenchState | null
  measuredState?: NonNullable<LearningRouteSnapshot['lastObservation']> | null
}
```

For the contract migration/schema, add columns equivalent to:

```sql
"route_snapshot_dedupe_key" text NOT NULL,
"snapshot_content_hash" text NOT NULL,
```

on `learning_route_snapshots`, and:

```sql
"observation_dedupe_key" text NOT NULL,
"measured_state_hash" text NOT NULL,
"workbench_state_hash" text,
"route_snapshot_dedupe_key" text,
```

on `learning_observations`.

Add unique indexes for the future upsert targets:

```sql
CREATE UNIQUE INDEX "learning_route_snapshots_owner_dedupe_unique"
ON "learning_route_snapshots" ("owner_user_id", "route_snapshot_dedupe_key");

CREATE UNIQUE INDEX "learning_observations_owner_dedupe_unique"
ON "learning_observations" ("owner_user_id", "observation_dedupe_key");
```

If you want org-scoped memory to become first-class later, be careful: nullable `organization_id` in unique indexes is a footgun in Postgres. Do not rely on:

```sql
UNIQUE(owner_user_id, organization_id, dedupe_key)
```

for private rows, because `NULL` values do not dedupe the way people often expect. Either keep the first version owner-scoped only, or introduce a non-null `memory_scope_key`.

---

## Dedupe key semantics I would use

### Route snapshot dedupe key

Purpose:

```txt
same logical route memory for this owner
```

Should stay the same when the learner updates:

```txt
currentQuestion
routeProgress
lastObservation
workbench state
snapshotJson contents
```

Should change when the route identity changes:

```txt
owner scope
routeObjectKey
snapshot source
mappingId
inputKind
```

Example key material:

```ts
const routeSnapshotDedupeMaterial = {
  keyVersion: 'cf-account-learner-memory-dedupe-v1',
  kind: 'learning_route_snapshot',
  ownerUserId: ownership.ownerUserId,
  organizationId: ownership.organizationId ?? null,
  visibility: ownership.visibility ?? 'private',
  snapshotVersion: snapshot.version,
  source: snapshot.source,
  inputKind: snapshot.inputKind,
  mappingId: snapshot.mappingId,
  routeObjectKey,
}
```

Then:

```ts
routeSnapshotDedupeKey = `lrs_v1_${sha256Canonical(routeSnapshotDedupeMaterial)}`
```

### Route snapshot content hash

Purpose:

```txt
exact payload integrity/revision
```

Example:

```ts
snapshotContentHash = `sha256_v1_${sha256Canonical(snapshot)}`
```

### Observation dedupe key

Purpose:

```txt
same learner observation attached to the same object in the same route context
```

This should dedupe repeated saves, but not collapse different predictions, different measured states, or different equation attachments.

Example key material:

```ts
const observationDedupeMaterial = {
  keyVersion: 'cf-account-learner-memory-dedupe-v1',
  kind: 'learning_observation',
  ownerUserId: ownership.ownerUserId,
  organizationId: ownership.organizationId ?? null,
  routeSnapshotDedupeKey,
  objectKey: resolvedObservationObjectKey,
  observationSource: observation.source,
  observationKind: observation.kind ?? 'route-state',
  normalizedObservation: omitVolatileObservationFields(observation),
}
```

I would omit `updatedAt` from the dedupe key, because repeated local saves may refresh timestamps while preserving the same actual learner observation. Keep `updatedAt` inside `measuredState` and `measuredStateHash`.

Then:

```ts
observationDedupeKey = `lob_v1_${sha256Canonical(observationDedupeMaterial)}`
measuredStateHash = `sha256_v1_${sha256Canonical(snapshot.lastObservation)}`
workbenchStateHash = workbenchState
  ? `sha256_v1_${sha256Canonical(workbenchState)}`
  : null
```

The canonical hash helper must sort object keys deterministically and preserve array order.

---

## Important attachment correction

The handoff should explicitly resolve the observation object key.

Right now the mapper does this:

```ts
const objectKey =
  snapshot.lastObservation.workbench?.equationObject.objectKey ??
  options.objectKey ??
  snapshot.currentObject?.objectKey
```

That is good.

But the preview write plan currently uses `currentObjectKey` for the observation. That can become misleading when the strict typed formula-workbench payload points to a more exact equation object.

For learner-memory correctness, the observation should attach to:

```txt
lastObservation.workbench.equationObject.objectKey
```

before falling back to:

```txt
snapshot.currentObject.objectKey
```

The handoff should expose that explicitly:

```ts
attachment: {
  objectKey: resolvedObservationObjectKey,
  resolution: 'typed-workbench-equation-object',
  currentObjectKey,
  workbenchEquationObjectKey,
}
```

This is directly aligned with the north star: the saved invariant must remain attached to the exact object the learner manipulated, not merely the surrounding concept page.

---

## Tests to add

Add tests around `prepareAccountLearnerMemoryImport` and the mapper/handoff builder.

### 1. Invalid snapshot returns no handoff

Input:

```txt
candidate is not cf-route-snapshot-v1
```

Assert:

```txt
status === 'invalid'
persisted === false
persistenceHandoff === undefined
```

### 2. Blocked snapshot returns no handoff

Input:

```txt
valid snapshot but missing route object key
```

Assert:

```txt
status === 'blocked'
persisted === false
persistenceHandoff === undefined
```

### 3. Auth-required snapshot returns no handoff

Input:

```txt
valid ready snapshot but no ownership
```

Assert:

```txt
status === 'auth-required'
persisted === false
persistenceHandoff === undefined
```

### 4. Write-ready snapshot returns handoff, not persistence

Input:

```txt
valid ready snapshot with valid owner UUID
```

Assert:

```txt
status === 'write-ready'
persisted === false
persistenceHandoff.persisted === false
persistenceHandoff.execution.status === 'not-executed'
persistenceHandoff.routeSnapshot.row.ownerUserId === ownerUserId
```

### 5. Route dedupe key is stable across progress edits

Create two snapshots with same:

```txt
owner
source
inputKind
mappingId
routeObjectKey
```

but different:

```txt
currentQuestion
routeProgress
lastObservation
snapshotJson content
```

Assert:

```txt
routeSnapshot.dedupeKey is the same
routeSnapshot.contentHash is different
```

### 6. Route dedupe key changes when route identity changes

Change one of:

```txt
mappingId
routeObjectKey
source
ownerUserId
```

Assert:

```txt
routeSnapshot.dedupeKey changes
```

### 7. Observation dedupe key is stable for repeated save

Use the same observation with only `updatedAt` changed.

Assert:

```txt
observation.dedupeKey is the same
measuredStateHash is different if updatedAt remains in measuredState
```

This gives you repeated-save safety without losing provenance.

### 8. Observation dedupe key changes when the learner actually changed the observation

Change one of:

```txt
prediction id
value
detail
invariant
result
labState
equation object key
```

Assert:

```txt
observation.dedupeKey changes
```

### 9. Typed workbench equation object wins over current object

Input snapshot:

```txt
currentObject.objectKey = concept:optimization/adam
lastObservation.workbench.equationObject.objectKey = equation:optimization/adam/bias-correction
```

Assert all of these equal the equation key:

```txt
persistenceHandoff.observation.attachment.objectKey
persistenceHandoff.observation.row.objectKey
result.workbenchRestore.equationObject.objectKey
preview.writePlan observation objectKey, if retained
```

This is one of the most important tests.

### 10. Observation dependency is explicit

Assert:

```txt
observation.dependsOn.dedupeKey === routeSnapshot.dedupeKey
observation.row.snapshotId === null
observation.dependsOn.snapshotIdResolution === 'resolve-after-route-snapshot-upsert'
```

The future adapter should resolve the real `snapshot_id` after the route snapshot upsert.

### 11. Mapper contract errors become blocked results

If `learningRouteSnapshotToSnapshotInsert` or `learningRouteSnapshotToObservationInsert` throws `ObjectMemoryContractError`, the API should not crash into an accidental 500 unless the auth owner is invalid.

Assert:

```txt
status === 'blocked'
persisted === false
reason includes contract error message
persistenceHandoff === undefined
```

### 12. Static guard: no runtime persistence imports

Extend the validator to assert that the contract-only API and handoff files do not import:

```txt
drizzle
@neondatabase
DATABASE_URL
CLERK_SECRET_KEY
@clerk
```

---

## What not to do yet

Do **not** import a Drizzle runtime client.

Do **not** import Clerk server runtime into this contract-only API.

Do **not** add a Neon connection string, pooled or unpooled.

Do **not** set `persisted: true`.

Do **not** make `/me` say “saved to account” when the response only says `write-ready`.

Do **not** trust client-supplied owner IDs, dedupe keys, or object keys without server validation.

Do **not** use `href`, title, label, or equation text as durable identity. Use `ContentObjectKey`.

Do **not** attach typed formula-workbench observations to the broad current concept when the workbench payload identifies a specific equation object.

Do **not** make observations destructive upserts. Observations are evidence records. Repeated exact saves should no-op; changed observations should create distinct memory.

---

## Risks that could corrupt learner memory later

The biggest corruption risk is **wrong object attachment**. If a formula-workbench observation about an equation gets attached to the surrounding concept, the learner’s invariant becomes less precise and future AI/help surfaces will retrieve the wrong context.

The second biggest risk is **route identity that is too broad**. If you dedupe only by `routeObjectKey`, two different learning routes about the same object can overwrite each other.

The third risk is **route identity that is too narrow**. If you hash the full snapshot as the route dedupe key, every small save becomes a new durable route row, and resumability becomes noisy.

The fourth risk is **observation overwrites**. Route snapshots can be “latest state” upserts. Observations should usually be insert-if-absent by dedupe key, not overwrite-by-object.

The fifth risk is **nullable org scope uniqueness**. If later you add org memory, do not rely casually on nullable `organization_id` inside unique indexes.

The sixth risk is **trust-boundary drift**. A response with `status: 'write-ready'` and `persisted: false` is honest. A UI that treats that as “saved” is not.

My concrete recommendation: implement the handoff and dedupe-key contract now, including the exact attachment-resolution test. After that, a dev-only adapter can be useful. Drizzle runtime should come only after the write semantics are already boring.
