Directionally, the plan is right: treat the typed workbench packet as the durable semantic payload, project it explicitly for account memory, and keep the database insert shape honest. The main risk is not technical plumbing; it is accidentally implying that the system has durable account memory and executable restore semantics before it actually does.

The safest framing is:

**Raw preservation:** `learning_observations.measured_state.lastObservation.workbench` preserves the full typed packet.

**Projected preview:** `/me` and import preparation expose a derived `workbenchRestore` packet.

**No persistence claim:** import responses remain `persisted: false` until real authenticated writes exist.

## Highest-risk omissions or overclaims

### 1. “Restorable” can overclaim if it only means “has a href”

A `restoreHref` is necessary, but not sufficient. Future restore needs the route, lab version, object identity, and lab state to agree. Otherwise the user may click a memory item and land on a page that cannot reconstruct the manipulation.

I would name the projection `workbenchRestore` only if the projection has all required fields. Otherwise return `workbenchRestore: null` plus a diagnostic such as:

```ts
workbenchRestoreUnavailableReason: 'missing-required-workbench-fields'
```

Avoid exposing a half-valid packet as restorable.

### 2. The current plan preserves the lab state, but not necessarily the pedagogical reason

Your north star is:

> selected object -> prerequisite gap -> prediction -> manipulation -> evidence -> invariant -> next move

The planned packet strongly covers:

```txt
selected object
prediction
manipulation
evidence
invariant
next move
```

But it does not explicitly preserve the **prerequisite gap** unless that is already elsewhere in the route snapshot. That is a product risk: the memory could restore *what the learner did* but lose *why this was the right next mathematical move*.

Consider adding, even as optional projection metadata:

```ts
pedagogy: {
  prerequisiteGap?: {
    id: string
    label: string
    text: string
  }
  nextMove?: {
    text: string
    href?: string
    objectKey?: string
  }
}
```

If you do not have prerequisite gap data yet, do not invent it. But reserve the field or explicitly test that the absence is intentional.

### 3. Account-memory projection and DB insert preservation can silently diverge

A common failure mode here is:

```txt
/me preview renders from one mapper
server import prepares from another mapper
DB-shaped measured_state preserves a third shape
```

That will pass superficial UI tests but break future restore.

Use one pure helper, for example:

```ts
projectAccountMemoryWorkbenchRestoreV1(lastObservation)
```

Then use it in both:

```ts
/me Study Memory preview
prepareAccountLearnerMemoryImport
```

And separately assert that the raw DB-shaped insert still contains the full original packet.

### 4. `measured_state` versus `measuredState` is a contract trap

Your context says the DB JSON is currently:

```ts
learning_observations.measured_state
```

But the plan says:

```ts
learning_observations.measuredState.workbench
```

That mismatch is worth fixing in tests immediately.

I would use this convention:

```ts
// DB-shaped insert
learning_observations[0].measured_state.lastObservation.workbench

// API/domain object, if camelCase exists elsewhere
learningObservations[0].measuredState.lastObservation.workbench
```

For the server import contract, if the object is explicitly “DB-shaped,” the test should assert snake case:

```ts
expect(insert.measured_state.lastObservation.workbench).toStrictEqual(workbench)
```

Do not let both spellings drift unless there is an explicit mapping layer with its own tests.

### 5. Object key routing needs a clear precedence rule

The plan to prefer the typed workbench equation object key is correct. The critical detail is that this should be the **observation’s mathematical object key**, not just a display convenience.

Recommended rule:

```ts
learning_observations.object_key =
  lastObservation.workbench.equationObject.objectKey
  ?? currentObject.objectKey
```

But if `equationObject.objectKey` is missing, I would not produce a `workbenchRestore` packet. Fallback is fine for routing the observation row; it is weaker for restore.

So:

```ts
object_key may fall back
workbenchRestore should require equationObject.objectKey
```

That distinction prevents pretending a partial typed packet is fully restorable.

### 6. Lab state needs a schema/version boundary

Preserving `lab.state` is good, but opaque state is risky. It may become stale, too large, or tied to transient UI details.

At minimum, the projection should include:

```ts
lab: {
  id: string
  version: string
  restoreHref: string
  state: JsonValue
}
```

If possible, add:

```ts
stateSchemaVersion?: string
stateDigest?: string
```

The digest is useful later for debugging restore mismatches without comparing huge JSON blobs.

### 7. `restoreHref` should be treated as data, not blindly executable

For future restore, do not let arbitrary saved hrefs become open redirects or unsafe navigations. Even if today you only preview the data, add a test or validation helper that distinguishes internal CF restore hrefs from arbitrary URLs.

For example:

```ts
restoreHref: '/learn/attention/serving?lab=kv-cache&restore=...'
```

should be acceptable.

But:

```ts
restoreHref: 'https://external.example/steal'
```

should not be considered restore-ready.

You can still preserve the raw href in `measured_state`; just do not expose it as executable `workbenchRestore.lab.restoreHref` unless it passes your internal route rule.

## Recommended projection field names

I would make the account-memory projection explicit and versioned:

```ts
export type AccountMemoryWorkbenchRestoreV1 = {
  kind: 'cf-account-memory-workbench-restore-v1'

  source: {
    snapshotKind: 'cf-route-snapshot-v1'
    path: 'lastObservation.workbench'
  }

  lab: {
    id: string
    version: string
    restoreHref: string
    state: JsonValue
  }

  equationObject: {
    objectKey: string
    href: string
    label: string
    equation: string
  }

  committedPrediction: {
    id: string
    label: string
    text: string
  } | null

  manipulation: {
    changed: JsonValue[]
    heldFixed: JsonValue[]
    evidence: string
    invariant: string
    result: string
    caveat: string | null
    nextMove: string | null
  }
}
```

Top-level response field:

```ts
accountMemoryPreview: {
  workbenchRestore: AccountMemoryWorkbenchRestoreV1 | null
}
```

For `/me`:

```ts
studyMemory: {
  workbenchRestore: AccountMemoryWorkbenchRestoreV1 | null
}
```

For import preparation:

```ts
{
  status: 'auth-required' | 'write-ready'
  persisted: false
  accountMemoryPreview: {
    workbenchRestore: AccountMemoryWorkbenchRestoreV1 | null
  }
  proposedInserts?: {
    learning_route_snapshots: unknown[]
    learning_observations: unknown[]
  }
}
```

If the existing contract already says `inserts`, keep it, but `proposedInserts` or `dbInsertPreview` is more honest than `inserts` while persistence is disconnected.

## Tests I would add

### 1. Projection preserves exact workbench restore fields

Test name:

```ts
it('projects a typed workbench observation into accountMemoryPreview.workbenchRestore without lossy field changes')
```

Assertions:

```ts
expect(restore.kind).toBe('cf-account-memory-workbench-restore-v1')

expect(restore.lab.id).toBe('attention-serving')
expect(restore.lab.version).toBe('v1')
expect(restore.lab.restoreHref).toBe('/learn/attention-serving?lab=kv-cache&restore=prediction-123')
expect(restore.lab.state).toStrictEqual({
  selectedHead: 3,
  sequenceLength: 8192,
  kvCacheEnabled: true
})

expect(restore.equationObject.objectKey).toBe('attention.serving.kv-cache-memory')
expect(restore.equationObject.href).toBe('/atlas/attention/serving/kv-cache-memory')
expect(restore.equationObject.label).toBe('KV cache memory')
expect(restore.equationObject.equation).toBe('M_{KV}=2Lhd_{head}')

expect(restore.committedPrediction).toStrictEqual({
  id: 'pred-kv-cache-linear-growth',
  label: 'Linear KV growth',
  text: 'Increasing sequence length should increase KV cache memory approximately linearly.'
})

expect(restore.manipulation.evidence).toBe('Doubling L doubled the KV cache term while h and d_head were held fixed.')
expect(restore.manipulation.invariant).toBe('Memory remains linear in L when h and d_head are fixed.')
expect(restore.manipulation.result).toBe('confirmed')
expect(restore.manipulation.caveat).toBe('Allocator overhead is not represented in the symbolic term.')
expect(restore.manipulation.nextMove).toBe('Compare attention compute scaling against KV memory scaling.')

expect(restore.manipulation.changed).toStrictEqual(['L'])
expect(restore.manipulation.heldFixed).toStrictEqual(['h', 'd_head'])
```

The exact values can differ, but the test should use distinctive strings so accidental fallback or truncation is obvious.

### 2. `/me` and import preparation use the same projection

Test name:

```ts
it('uses the same workbenchRestore projection for /me preview and prepareAccountLearnerMemoryImport')
```

Assertion:

```ts
expect(mePreview.studyMemory.workbenchRestore)
  .toStrictEqual(importResult.accountMemoryPreview.workbenchRestore)
```

This prevents two subtly different restore paths from developing.

### 3. Auth-required import includes preview but does not imply persistence

Test name:

```ts
it('returns workbenchRestore in auth-required import preview with persisted=false and no committed write ids')
```

Assertions:

```ts
expect(result.status).toBe('auth-required')
expect(result.persisted).toBe(false)
expect(result.accountMemoryPreview.workbenchRestore).toStrictEqual(expectedRestore)

expect(result).not.toHaveProperty('insertedIds')
expect(result).not.toHaveProperty('saved')
expect(result).not.toHaveProperty('persistedAt')
```

If you return proposed DB rows even in `auth-required`, name them as a plan:

```ts
expect(result.proposedInserts.learning_observations).toHaveLength(1)
```

But do not call them written rows.

### 4. Write-ready import still says `persisted=false`

Test name:

```ts
it('returns write-ready proposed inserts with persisted=false until Clerk Neon writes are connected')
```

Assertions:

```ts
expect(result.status).toBe('write-ready')
expect(result.persisted).toBe(false)
expect(result.accountMemoryPreview.workbenchRestore).toStrictEqual(expectedRestore)
expect(result.proposedInserts.learning_observations).toHaveLength(1)
```

This is the anti-overclaim test.

### 5. DB-shaped insert preserves raw typed packet in `measured_state`

Test name:

```ts
it('preserves lastObservation.workbench exactly inside learning_observations.measured_state')
```

Assertion:

```ts
const observationInsert = result.proposedInserts.learning_observations[0]

expect(observationInsert.measured_state.lastObservation.workbench)
  .toStrictEqual(snapshot.lastObservation.workbench)
```

Also assert that no fake DB column was added:

```ts
expect(observationInsert).not.toHaveProperty('workbenchRestore')
expect(observationInsert).not.toHaveProperty('workbench_restore')
expect(observationInsert).not.toHaveProperty('restore_href')
expect(observationInsert).not.toHaveProperty('lab_state')
```

That keeps the DB contract honest.

### 6. Observation object key prefers the typed equation object key

Test name:

```ts
it('routes learning_observations.object_key using workbench.equationObject.objectKey before currentObject.objectKey')
```

Setup:

```ts
currentObject.objectKey = 'attention.generic-current-object'
workbench.equationObject.objectKey = 'attention.serving.kv-cache-memory'
```

Assertion:

```ts
expect(observationInsert.object_key).toBe('attention.serving.kv-cache-memory')
```

### 7. Observation object key falls back only when typed object key is missing

Test name:

```ts
it('falls back to currentObject.objectKey for observation routing when workbench equation object key is absent')
```

Assertion:

```ts
expect(observationInsert.object_key).toBe('attention.generic-current-object')
```

But also:

```ts
expect(result.accountMemoryPreview.workbenchRestore).toBeNull()
```

That distinction matters: fallback row routing is acceptable; fallback restore identity is not.

### 8. Missing optional fields become null, not undefined

Test name:

```ts
it('normalizes missing optional workbench fields to null in workbenchRestore')
```

Assertions:

```ts
expect(restore.manipulation.caveat).toBeNull()
expect(restore.manipulation.nextMove).toBeNull()
expect(JSON.stringify(restore)).not.toContain('undefined')
```

This protects JSON stability.

### 9. Invalid or external restore href is preserved raw but not exposed as restore-ready

Test name:

```ts
it('does not project external restoreHref as accountMemoryPreview.workbenchRestore')
```

Setup:

```ts
workbench.restoreHref = 'https://example.com/not-a-cf-restore'
```

Assertions:

```ts
expect(result.proposedInserts.learning_observations[0].measured_state.lastObservation.workbench.restoreHref)
  .toBe('https://example.com/not-a-cf-restore')

expect(result.accountMemoryPreview.workbenchRestore).toBeNull()
expect(result.accountMemoryPreview.workbenchRestoreUnavailableReason)
  .toBe('invalid-restore-href')
```

### 10. Lab state remains JSON, not stringified

Test name:

```ts
it('keeps lab.state as structured JSON in both projection and measured_state')
```

Assertions:

```ts
expect(typeof restore.lab.state).toBe('object')
expect(restore.lab.state).toStrictEqual(workbench.lab.state)

expect(typeof observationInsert.measured_state.lastObservation.workbench.lab.state).toBe('object')
```

### 11. Unknown future workbench versions are preserved but not projected

Test name:

```ts
it('preserves unknown workbench versions in measured_state without projecting a v1 restore packet')
```

Assertions:

```ts
expect(observationInsert.measured_state.lastObservation.workbench).toStrictEqual(workbench)
expect(result.accountMemoryPreview.workbenchRestore).toBeNull()
expect(result.accountMemoryPreview.workbenchRestoreUnavailableReason)
  .toBe('unsupported-workbench-version')
```

This gives you forward compatibility without lying about restore safety.

## The biggest product-level addition I would make

Add a small explicit distinction between **learner claim** and **mathematical truth**.

Fields like `committedPrediction`, `evidence`, and `invariant` are pedagogically powerful, but they are not necessarily verified facts. Avoid names such as:

```ts
verifiedInvariant
correctPrediction
provenResult
```

Prefer:

```ts
committedPrediction
observedEvidence
statedInvariant
result
caveat
```

Your current names are mostly safe. I would only consider renaming `evidence` to `observedEvidence` and `invariant` to `statedInvariant` if the product will later distinguish learner claims from system-verified conclusions.

## The strongest minimal contract

The robust version of the plan is:

```txt
1. Raw typed packet is preserved exactly in measured_state.
2. A versioned workbenchRestore projection is derived from that packet.
3. /me and import preparation use the same projection helper.
4. Proposed DB rows remain DB-shaped; no fake restore columns.
5. Import responses always say persisted=false until writes exist.
6. object_key routing prefers workbench.equationObject.objectKey.
7. Restore projection is withheld when required restore fields are missing or unsafe.
```

That gives you a real future restore path without pretending account persistence exists today.
