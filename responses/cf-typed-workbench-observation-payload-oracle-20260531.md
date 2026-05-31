1. **Schema/drop/bloat risk**

   * **Main drop risk:** `isLastObservation()` still requires full legacy formula mirrors when `kind === 'formula-comparison'`: `changed`, non-empty `heldFixed`, `result`, `caveat`, and `labState`. That is fine for the snapshots you now write, but any older formula snapshot that only had metadata in `detail` and missed one mirror will be dropped.
   * **Typed payload bloat is bounded**, not runaway. The new workbench fields are length-capped and `maxSnapshotRawLength = 24000` still protects localStorage. The only practical bloat risk is duplication: `detail` + legacy mirrors + typed `workbench` all carry overlapping facts. If the server later writes both raw `lastObservation` and a projected `workbenchObservation`, account memory will double-store the same observation.
   * **Do not loosen/delete legacy `detail` prefix.** The current `labId=...; labVersion=...; predictionId=...; ...` mirror preserves the `/paths/attention-serving`-style legacy restore path.

2. **Missing for future restore/account persistence**

   * Raw snapshot has the important restore state: `workbench.lab.id`, `version`, `state`, `restoreHref`, plus `labState`.
   * The **account-memory projection drops `workbench.lab.restoreHref`**. If durable memory writes from `AccountLearnerMemoryWorkbenchObservation`, you lose the canonical resume/deep-link.
   * Also worth carrying through if the DB row is projected rather than raw: `equationObject.href`, `equationObject.equation`, and `committedPrediction.text`.
   * Future-proofing: `changed` is singular. Fine for this workbench, but multi-knob labs will want `changed: Changed[]` or an explicit `manipulation` field.

3. **Should `/me Study Memory` render typed payload as implemented?**

   * **Yes for the current Efficient Attention path**, because the producer writes both `kind: 'formula-comparison'` and `workbench`, and `workbenchObservationSummary()` prefers typed once inside that branch.
   * But it is not truly “typed first” yet. A valid snapshot with `lastObservation.workbench` but no legacy `kind` would pass schema and **not** render as a workbench memory.

4. **One fix before commit**

   * Move typed workbench detection before the legacy `kind` gate, and carry `restoreHref` into the account-memory projection.

```ts
function workbenchObservationSummary(snapshot: LearningRouteSnapshot) {
  const observation = snapshot.lastObservation
  if (!observation) return undefined

  const typedWorkbench = typedWorkbenchObservationSummary(snapshot, observation)
  if (typedWorkbench) return typedWorkbench

  if (observation.kind !== 'formula-comparison') return undefined

  // legacy detail parsing fallback...
}
```

That makes the consumer match the migration rule: **typed first, legacy prose fallback second**.
