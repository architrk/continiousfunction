Overall: the direction is right, but the current integration is not actually wired yet. `EfficientAttentionLivingLabPanel` accepts `savedRouteSnapshot` / `onSaveObservation`, and defines `saveWorkbenchObservation()`, but `ConceptNotebookPage` renders `<EfficientAttentionLivingLabPanel />` with no props, and no action calls `saveWorkbenchObservation`.

## Top 5 implementation improvements

1. **Wire save/restore end-to-end as a route observation, not panel state.**

```tsx
<EfficientAttentionLivingLabPanel
  savedRouteSnapshot={routeSnapshot}
  onSaveObservation={rememberEfficientAttentionWorkbenchObservation}
/>
```

Add a shell action:

```ts
{
  id: 'carry-observation',
  label: routeSaveStatus === 'saved' ? 'Observation carried' : 'Carry observation',
  onClick: saveWorkbenchObservation,
  variant: 'primary',
}
```

Parent save should build a `LearningRouteSnapshot` whose `currentObject` is the exact KV-cache equation object, not whichever concept object happened to be selected.

2. **Store an AI-safe structured packet, not parseable prose.**

Avoid `observation.detail?.match(/predictionId=.../)`. Add bounded structured fields to `lastObservation`, such as:

```ts
prediction: { id, label, prompt, wasCorrect }
invariant: string
evidenceSource: 'local-equation-calculation'
nextMove: { label, href? }
labState: { context, layers, queryHeads, kvHeads, dHead, batch, bytes }
```

The packet should separate: learner prediction, computed evidence, held-fixed assumptions, caveat, selected object key, source IDs, and next move. That lets an AI tutor or Object Room use it without inventing context.

3. **Add real learner-memory UX states.**

Replace “Saved to browser route memory” with copy that describes the cognitive action:

* “Carry this observation”
* “Observation carried into your route”
* “Restored local lab note: you predicted quarter cache; the equation measured 4.0× less memory.”
* “Update carried observation”
* “Start fresh”

Add states beyond `idle | needs-prediction | saved | error`:

```ts
'idle' | 'needs-prediction' | 'revealed-unsaved' | 'saved' | 'dirty' | 'restored' | 'restore-mismatch' | 'error'
```

Critical: after a save, changing `T`, `g`, or precision should mark the note dirty.

4. **Fix the prediction correctness mismatch.**

Right now:

```ts
const predictionCorrect = prediction === 'quarter'
```

That is only true for `g = 4`. But the learner can change `groupSize`. Either lock `g = 4` until reveal, or compute the expected prediction from the current `groupSize`.

For example:

```ts
const expectedPrediction =
  groupSize === 1 ? 'same'
  : groupSize === 4 ? 'quarter'
  : 'drops-by-sharing'
```

At minimum, do not restore or save “Correct” unless the saved prediction prompt, saved `groupSize`, and current `groupSize` match.

5. **Harden localStorage as local route memory, not durable memory.**

Guard against: disabled storage, quota failure, stale schema, changed concept content, invalid object anchors, one-slot overwrite, and cross-tab last-write-wins.

Small patch:

* include `labId: 'efficient-attention-kv-cache-workbench'`
* include `labVersion`
* require matching `mappingId`, `labId`, `queryHeads`, `layers`, `dHead`, and valid option values before restoring
* show “Saved note exists, but this lab version changed” instead of silently restoring
* merge with the previous route snapshot instead of clobbering richer route history

The highest-impact product move is to make the saved note appear in `LearningRouteContinuityBanner`, `ObjectRoomPanel`, and the Research Room as a compact carried invariant: **prediction → evidence → invariant → next move**. That turns it from a bookmark into learner memory.
