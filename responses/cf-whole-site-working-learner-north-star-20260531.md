The current direction is strong, but it is carrying too many metaphors at once: atlas, notebook, lab, seminar room, AI tutor, learning OS, community commons. The sharper product move is to make **one stateful mathematical workbench** visible everywhere.

## 1. Sharper whole-site north star

**Continuous Function should make modern AI math operable.**

Every important object — a paper span, equation, architecture, training behavior, inference tradeoff, demo state, code witness, claim, or misconception — should become a selectable mathematical object that can be:

**located, prerequisite-repaired, predicted against, manipulated, checked against evidence, named as an invariant, saved, and carried into the next object.**

A tighter operational version:

> Continuous Function turns opaque AI learning objects into usable mechanistic invariants through a persistent math workbench: select the object, repair the missing structure, test a prediction, inspect the evidence, name what stays true, and continue with context intact.

This is better than “learning operating system” because it tells the product exactly what to render, save, and optimize.

The core unit is not the page.
The core unit is:

```txt
selected object -> prerequisite gap -> prediction -> manipulation -> evidence -> invariant -> next move
```

Every page should expose that unit.

---

## 2. Common user needs the product should optimize for

### 1. Object clarity

The page must always answer: **what exact mathematical object am I working on right now?**

Not “attention.”
Something like:

```txt
selected object:
KV-cache memory growth under autoregressive decoding
```

or:

```txt
selected equation:
softmax(QKᵀ / √d)V and the shape constraints behind it
```

Vague topic pages are less valuable than precise object surfaces.

---

### 2. Prerequisite repair without derailment

When something is missing, the site should not send the user wandering. It should offer a compact repair path:

```txt
You are missing:
1. tensor shapes in batched attention
2. softmax as normalized competition
3. causal masking

Repair now / skim bridge / continue with caveat
```

Prerequisite repair should feel like changing lenses, not leaving the room.

---

### 3. Symbol and shape grounding

Every equation-heavy surface needs immediate answers to:

```txt
What are the symbols?
What are the shapes?
What assumptions are being made?
What changes if the assumption fails?
```

A lot of confusion in AI math is not conceptual. It is symbol drift, shape drift, and hidden assumption drift.

---

### 4. Representation alignment

The site should constantly synchronize:

```txt
intuition <-> equation <-> code <-> visual/demo <-> source/evidence
```

No representation should float alone. A code block should point to the equation it witnesses. A demo control should point to the variable it changes. A paper claim should point to the concept and assumption it depends on.

---

### 5. Prediction before reveal

The product should make prediction the default mode of interaction.

Not because quizzes are cute, but because mechanistic understanding requires the user to expose their current model before seeing the system behavior.

The important question is:

```txt
What do you expect will happen when this variable changes?
```

Then:

```txt
What actually changed?
What stayed invariant?
Why?
```

---

### 6. Evidence, not reassurance

The product should avoid “Correct!” as the primary feedback. It should show evidence:

```txt
Your prediction: latency should increase linearly.
Observed: latency bends upward after context length crosses N.
Reason: memory bandwidth becomes the bottleneck.
Invariant: attention score computation scales with the live token window unless approximation or compression changes the object.
```

The learner should leave with a named mechanism, not a dopamine hit.

---

### 7. Continuity across surfaces

Search, graph, domains, concept notebooks, demos, and Paper Mapper should preserve the same working state.

The site should remember:

```txt
current question
selected object
route step
prediction
revealed evidence
saved invariant
next move
```

Without this, the site remains a polished library. With it, it becomes a work environment.

---

### 8. Trust boundaries

The site must distinguish:

```txt
source says
the page derives
the demo suggests
the author infers
unknown / disputed / caveat
```

This matters especially for frontier AI topics where claims, implementations, and interpretations move faster than textbooks.

---

### 9. Low-friction return

The most important daily-use question is:

```txt
What was I trying to understand, and what is the next useful move?
```

A returning session should not begin with rediscovery.

---

## 3. Product principles that follow

### Principle 1: Object-first, page-second

A page is a container. The selected learning object is the product.

Every major page should expose a `selectedObject` with an id, kind, title, question, prerequisite links, representations, evidence, and next moves.

---

### Principle 2: One active object per viewport

The first viewport should not present a buffet of cards. It should show:

```txt
where you are
what object is active
what question is being worked
what action to take next
```

Dense pages are fine. Ambiguous pages are not.

---

### Principle 3: Navigation is pedagogy

Search results, graph nodes, route strips, and domain pages should not merely move users around. They should explain why the next object matters.

Bad:

```txt
Related concepts
```

Better:

```txt
Repair this before continuing because the demo assumes you understand causal masking.
```

---

### Principle 4: Interaction must reveal mechanism

No animation, slider, graph, or visual component should exist unless it makes a variable, invariant, bottleneck, failure mode, or assumption easier to inspect.

Motion is not engagement.
Causal visibility is engagement.

---

### Principle 5: Prediction checkpoints are first-class components

Prediction should not be handcrafted per demo. It should be a reusable product primitive with:

```txt
prompt
expected variable
user prediction
commit state
reveal state
measurement
explanation
saved observation
next move
```

---

### Principle 6: Math must stay close to code and evidence

Equations should not be ornamental. Each important equation should have at least one of:

```txt
shape table
minimal code witness
demo control
source span
failure case
```

---

### Principle 7: Memory should save useful evidence, not generic notes

The first memory system should not be a general notebook. It should save small structured observations:

```txt
I predicted X.
The system showed Y.
The invariant is Z.
Next I should inspect W.
```

Generic notes can come later.

---

### Principle 8: AI should attach to objects, not pages

The eventual AI layer should never feel like a floating chatbot. It should know the selected object, current equation, source boundary, prediction history, and current route step.

Until live AI is production-ready, prompt-copy anchors are acceptable — but they should already carry object context.

---

### Principle 9: Static-first surfaces should still feel stateful

Because the site is currently static-exported, the next slice should use local state and local persistence well. Account-backed memory can later absorb the same schema.

The schema matters more than the backend at this stage.

---

## 4. What the site must make effortless in daily use

The site should make these actions nearly frictionless:

```txt
Bring a question.
Map it to a precise object.
See what prerequisites are missing.
Open a compact repair bridge.
Inspect the symbols and shapes.
Run or read a minimal code witness.
Make a prediction before reveal.
Manipulate one meaningful variable.
Compare prediction against evidence.
Name the invariant.
Save the observation.
Carry the object into graph/search/Paper Mapper/concept pages.
Resume later from the same question and next move.
```

The hard part should be the mathematics.

The easy part should be:

```txt
Where am I?
What am I studying?
What should I try?
What changed?
What is now known?
Where do I go next?
```

The product should create desirable difficulty around the concept, not accidental difficulty around the interface.

---

## 5. First concrete implementation goal for Codex now

### Build `LivingNotebookLabShell` V1 and migrate the first two surfaces into it

Codex should not write another strategy document. It should extract the reusable shell contract from **Efficient Attention** and **Paper Mapper**, then make both surfaces use the same object-state spine.

The goal:

> Create a static-export-compatible `LivingNotebookLabShell` that standardizes the first viewport, selected object state, prediction checkpoint, evidence ledger, next moves, and local route memory across the site.

This should become the reusable whole-site workbench shell.

### Suggested implementation shape

Use existing repo conventions, but the product contract should be roughly:

```ts
type LearningObjectKind =
  | "concept"
  | "equation"
  | "paper-span"
  | "claim"
  | "architecture"
  | "demo-state"
  | "code-witness"
  | "misconception"
  | "route-step";

type LearningObject = {
  id: string;
  kind: LearningObjectKind;
  title: string;
  question: string;
  invariantTarget?: string;
  prerequisites?: Array<{
    id: string;
    title: string;
    reason: string;
    href: string;
    repairDepth?: "skim" | "bridge" | "full";
  }>;
  representations?: {
    intuition?: string;
    equationId?: string;
    codeWitnessId?: string;
    demoId?: string;
    sourceIds?: string[];
  };
};

type PredictionCheckpointState = {
  id: string;
  prompt: string;
  variableUnderTest: string;
  userPrediction?: string;
  committed: boolean;
  revealed: boolean;
  measurement?: string;
  invariant?: string;
};

type EvidenceItem = {
  id: string;
  label: string;
  kind: "source" | "demo" | "derivation" | "code" | "inference" | "caveat";
  summary: string;
  confidence?: "given" | "derived" | "observed" | "inferred" | "uncertain";
};

type NextMove = {
  id: string;
  label: string;
  href?: string;
  action?: "repair" | "predict" | "inspect" | "run" | "compare" | "save" | "continue";
  reason: string;
};

type LearningSessionSnapshot = {
  pageId: string;
  selectedObjectId: string;
  currentQuestion: string;
  prediction?: PredictionCheckpointState;
  savedInvariant?: string;
  evidenceOpened?: string[];
  nextMoveId?: string;
  updatedAt: string;
};
```

The first build should include these reusable components:

```txt
LivingNotebookLabShell
RouteStateStrip
SelectedObjectBar
PrerequisiteRepairDock
WitnessTriad
PredictionCheckpoint
EvidenceLedger
InvariantSaveCard
NextMoveDock
ObjectAttachedPromptCard
```

Do not overbuild them. The V1 shell only needs enough structure to make Efficient Attention and Paper Mapper feel like parts of the same environment.

### Required behavior

Efficient Attention and Paper Mapper should both show the same workbench spine:

```txt
RouteStateStrip
SelectedObjectBar
current question
primary prediction or inspection action
evidence ledger
saved invariant
next move dock
```

Paper Mapper may emphasize source/object mapping.
Efficient Attention may emphasize demo/math/code manipulation.
But they should feel like different instruments inside the same lab, not separate products.

---

## 6. Acceptance criteria

### Contract and reuse

* A reusable shell contract exists in code, not just prose.
* Efficient Attention and Paper Mapper both consume the same shell-level object/session types.
* The two surfaces no longer maintain entirely separate versions of route state, selected object display, prediction state, and observation saving.
* The components are generic enough to support a future concept notebook without renaming everything around attention or papers.

### First viewport

On both migrated surfaces, the first viewport must answer:

```txt
Where am I?
What object is selected?
What question is active?
What should I do next?
What will be saved or carried forward?
```

No large decorative hero should push the working object below the fold.

### Selected object behavior

* The selected object has a stable id.
* The selected object displays kind, title, active question, and at least one next action.
* Changing the selected object updates the prediction/evidence/next-move area.
* Object ids are compatible with URL params or future persisted memory.

### Prediction checkpoint

At least one migrated flow must support:

```txt
write/choose prediction
commit prediction
reveal evidence
keep original prediction visible
show measured/derived result
name invariant
save observation
```

The reveal should not merely say correct or incorrect.

### Evidence ledger

Evidence items must distinguish among:

```txt
source
demo observation
derivation
code witness
inference
caveat
```

Each evidence item should have a compact confidence label such as:

```txt
given
derived
observed
inferred
uncertain
```

### Local memory

* A `LearningSessionSnapshot` saves to local storage.
* Reloading the page restores selected object, current question, committed prediction, revealed evidence, saved invariant, and next move where applicable.
* The schema is clean enough to later migrate into account-backed memory without redesigning the product model.

### Next moves

Both migrated surfaces must end meaningful interactions with one to three next moves, not a generic list of links.

Good next moves look like:

```txt
Repair causal masking before continuing.
Inspect the KV-cache memory term.
Compare this with linear attention.
Save this invariant and continue to the paper claim.
```

### Object-attached AI readiness

Even without production AI, the shell should support an object-attached prompt card that can copy structured context:

```txt
selected object
current question
prediction
evidence
invariant
source boundary
requested help mode
```

This prepares the AI layer without shipping a generic chatbot.

### Accessibility and responsive QA

* Works at desktop width and around 390px mobile width.
* No horizontal overflow.
* Prediction controls are keyboard reachable.
* Tap targets are usable on mobile.
* Color is not the only state indicator.
* Math, code, and evidence labels do not collide or clip.

### Build quality

* Static export still works.
* TypeScript passes.
* Lint/build scripts pass using the repo’s existing commands.
* No server-only dependency is introduced.
* No account/auth/database work is required for this slice.
* No new broad content pages are added merely to demonstrate the shell.

---

## 7. What not to do

Do **not** make the next milestone a public vision page. The product already has enough vision. It needs a working spine.

Do **not** add explicit audience segmentation to the site experience. Avoid navigation or copy that says “for students,” “for researchers,” “for engineers,” or similar. The common need is precise mathematical work, not identity sorting.

Do **not** build a generic AI chat panel. AI should wait behind object-attached prompts and selected-object context.

Do **not** launch community, comments, rooms, profiles, or feeds yet. A static object-room mock is fine only if it strengthens the object model.

Do **not** start account-backed memory before the local object/session schema is right. Persistence should preserve a good product state, not compensate for a vague one.

Do **not** add more demos until the existing strong demos share the same prediction/evidence/invariant loop.

Do **not** make Paper Mapper a separate product island. It should become one entry point into the same workbench state as concepts, graph, search, and demos.

Do **not** let “Living Notebook Lab” become an aesthetic wrapper. It has to be a behavioral contract.

Do **not** save generic notes as the first memory primitive. Save structured observations tied to objects.

Do **not** treat correctness as the main feedback. The product should optimize for named mechanisms, failure modes, assumptions, and invariants.

Do **not** broaden the roadmap now. The next product proof is narrow:

```txt
one shared shell
two migrated flagship surfaces
one selected-object model
one prediction loop
one evidence ledger
one local saved invariant
one next move that survives reload
```

That slice is the shortest path from “excellent pages” to “coherent mathematical work environment.”
