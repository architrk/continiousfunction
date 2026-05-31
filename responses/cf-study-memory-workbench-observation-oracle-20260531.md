1. **Highest-impact risk**

The card currently risks turning a **copy string** into a learning fact.

`workbenchObservationSummary()` derives key pedagogy fields by parsing `lastObservation.value` and `lastObservation.detail`:

* prediction from `value.split(':')`
* `predictionId`, `labId`, `labVersion` from semicolon metadata inside `detail`
* invariant by searching for `"For fixed "`

That is too brittle for a first-class memory object. The learner’s **committed prediction before reveal** is the pedagogical anchor; it should not be inferred from display prose. Same for lab boundary and invariant.

The risk is not just technical. It could make the card falsely imply: “this is exactly what I predicted and learned,” when it is partly reconstructed from a narrative sentence.

2. **Recoverable enough to continue?**

**Almost, but not quite.**

For human recall, yes: the card shows selected object, prediction-ish text, evidence, invariant, changed variable, fixed variables, caveat, and next move.

For true workbench continuation, not yet: the card does not visibly show the **exact equation** or the full **lab state** needed to reproduce the run, and `Open current object` may take the learner to the concept/object, not the KV lab restored to the saved state.

So the prior experiment is recoverable as a note, but not yet recoverable as a runnable continuation point.

3. **One improvement next**

Make `lastObservation` carry a typed workbench payload instead of parsing `detail`.

Something like:

```ts
workbench?: {
  equationObject: {
    label: string
    equation: string
    objectKey?: ContentObjectKey
  }
  committedPrediction: {
    id: string
    label: string
    text: string
  }
  evidence: string
  invariant: string
  changed: { symbol: string; from: number; to: number }
  heldFixed: Array<{ symbol: string; value: string | number }>
  result: { before: number; after: number; ratio: number; unit: 'GB-decimal' | 'GiB' }
  caveat: string
  lab: {
    id: string
    version: string
    state: KvLabState
  }
}
```

Then render the card only from that typed payload. Keep `detail` as optional human-readable prose, not as a data transport.

4. **UI copy / field boundary changes before commit**

Change the persistence copy to avoid overclaiming account memory:

* **“Ready for account memory”** → **“DB-shaped preview — not saved to account”**
* **“What the account write will preserve”** → **“What would be written after sign-in”**
* **“Carry the thread across sessions.”** → **“Preview the thread this browser can carry.”**
* **“Workbench memory”** → **“Workbench memory preview”**

Tighten the field labels:

* **“Prediction”** → **“Committed prediction before reveal”**
* **“Evidence”** → **“Observed lab evidence”**
* **“Invariant”** → **“Invariant to reuse”**
* Boundary line should include grounding status, for example:
  **“Browser-local preview · KV memory lab · efficient-attention-kv-memory@v1 · not account-backed”**

Field boundary I would change before commit:

* `predictionId`, `labId`, and `labVersion` should not live inside `detail`.
* `observation.value` should not be parsed as prediction.
* `primaryEquation` should be rendered inside the Workbench card, not only implied by selected object.
* `groundingStatus` should appear beside the evidence/caveat, not just exist in the snapshot.
* `labState` should either be shown in a compact “Restore state” block or used by a “Reopen lab with this state” action.
