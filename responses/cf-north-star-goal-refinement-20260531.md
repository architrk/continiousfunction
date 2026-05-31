## 1. One-sentence north star

**Continuous Function should be the place where a serious learner can bring a frontier-AI paper, equation, architecture, or system behavior and leave with a tested, source-grounded invariant they can use to reason, build, teach, or read the next paper.**

This is stricter than “make AI math understandable.” It says the product must start from real research confusion, attach that confusion to exact learning objects, force an active prediction, show evidence, and produce a usable invariant plus next move.

---

## 2. Stricter operational goal

**In one sitting, Continuous Function must let a serious learner, researcher, engineer, or teacher turn one hard AI-math question into a complete learning artifact:**

```txt
current question
→ selected paper span / concept / equation / claim / code witness / demo state
→ prerequisite route
→ prediction
→ manipulation or inspection
→ evidence
→ invariant
→ saved observation
→ next repair concept, source, experiment, or teaching move
```

The implementation target is not “the user reads a nice page.” The target is:

**A user can enter through Paper Mapper, Search, Graph, Home, or a Concept page; select one precise object; test one claim; and leave with a resumable route card that preserves what they were trying to understand, what object they inspected, what changed, what stayed invariant, and what to do next.**

For each role, the same session should be valuable:

* **Learner:** repairs a prerequisite and can restate the mechanism.
* **Researcher:** maps a paper claim to exact concepts, assumptions, and sources.
* **Engineer:** connects the math to code, systems constraints, or model behavior.
* **Teacher/Professor:** gets a teachable object with misconception, evidence, and next exercise.

The minimum successful session artifact should be:

```txt
Question:
  "Why does long-context attention become memory-bound?"

Selected object:
  KV-cache memory equation / paper span / efficient attention concept

Prediction:
  "Doubling context length doubles cache memory if heads, layers, and head dim stay fixed."

Evidence:
  Demo measurement, equation terms, code witness, source/caveat

Invariant:
  "For fixed model shape and precision, KV-cache memory scales linearly with sequence length and batch size."

Next move:
  Compare MQA/GQA, sliding window attention, paged attention, or SSM hybrids.
```

That is the product. Everything else is support.

---

## 3. Core learning loop

Name it:

# **The Question-to-Invariant Loop**

Canonical form:

```txt
Question
→ Object
→ Prediction
→ Manipulation
→ Evidence
→ Invariant
→ Next Move
```

How it should appear everywhere:

| Surface           | Loop expression                                                                     |
| ----------------- | ----------------------------------------------------------------------------------- |
| **Homepage**      | Resume the learner’s last question and route before browsing.                       |
| **Search**        | Convert a query into candidate objects, not generic results.                        |
| **Graph**         | Show the route from current object to prerequisites and next concepts.              |
| **Concept pages** | Teach one current object through intuition, math, code, demo, and invariant.        |
| **Paper Mapper**  | Turn paper spans, claims, or equations into concept routes and live labs.           |
| **Study memory**  | Save only the useful observation: question, object, evidence, invariant, next move. |

The loop should become the app’s recognizable grammar. A user should feel the same product promise whether they start from a paper, a concept, a graph node, a search query, or a saved route.

---

## 4. What to optimize for — and what to stop optimizing for

## Optimize for

**1. Durable mechanistic understanding**

The user should be able to explain what changed, what stayed invariant, and why. Optimize for the learner’s next thought becoming easier.

**2. One exceptional end-to-end flagship loop**

Depth beats breadth. A single route that goes from paper question to equation to prediction-first lab to saved observation is more valuable than twenty attractive but disconnected pages.

**3. Exact learning objects**

The core unit is not “topic.” It is:

```txt
concept
equation
claim
paper span
source
code witness
demo state
misconception
route
observation
```

Every AI prompt, route, object room, note, and next move should attach to one of these.

**4. Prediction before reveal**

The app should ask the learner to commit. Interaction is useful only when it tests or reveals a mechanism.

**5. Math-code-demo equivalence**

For serious concepts, the equation, code witness, and demo should teach the same invariant. If they drift apart, the page becomes decorative.

**6. Source-grounded research learning**

Paper Mapper and AI surfaces should be careful, skeptical, and object-attached. The product should help users reason about papers without flattening the hard parts.

**7. Continuity**

A learner should not restart from scratch after every route change. The current question, selected object, prediction, observation, and next move should persist across Home, Search, Graph, Paper Mapper, and Concept pages.

**8. Role-sensitive usefulness without fragmenting the product**

Learner, Researcher, Experimenter, and Professor lenses are valuable only if they clarify the same object from different angles.

---

## Stop optimizing for

**More pages.** Page count is a misleading metric until one flagship loop is excellent.

**More animation.** Motion should reveal causality. Otherwise it is noise.

**Generic AI chat.** A chatbot that does not know the selected equation, paper span, demo state, route, and misconception is off-mission.

**Broad community.** Object rooms before feeds. Structured contribution before discussion volume.

**Decorative polish.** Beauty is useful only when it lowers cognitive load or makes the mechanism easier to inspect.

**Course catalog breadth.** Continuous Function should not feel like a list of topics. It should feel like an atlas with instruments.

**Paper summaries without prerequisite repair.** A paper-mapping feature that summarizes but does not route the learner to equations, concepts, demos, and next moves is not enough.

**Premature platform infrastructure.** Accounts, billing, collaboration, and community matter later, but the first proof is one lovable, rigorous learning loop.

---

## 5. First flagship slice

# **Paper Mapper → Efficient Attention Cockpit → KV-Cache Lab Handoff**

Given the current implementation context, the most leverageful near-term slice is:

**Turn Paper Mapper’s first viewport into the canonical paper-to-atlas cockpit, using the existing Efficient Attention / KV-cache lab as the live destination, then extract the reusable Living Notebook Lab shell contract from that slice.**

This should not be a generic redesign. It should prove the whole product thesis in one route.

Target route:

```txt
Paper question:
  "Why do long-context transformers become expensive to serve?"

Paper Mapper cockpit:
  selected paper / claim / equation / system bottleneck

Mapped object:
  KV-cache memory equation

Concept route:
  Efficient Attention → KV cache → MQA/GQA or long-context variants

Flagship lab:
  KV-cache memory equation lab with role lenses, prediction, controls, measurements, evidence, invariant, next move

Saved artifact:
  observation + AI handoff packet + route continuation
```

The first viewport should make the learner immediately see:

```txt
Where am I?
  Paper Mapper, inside a specific research question or sample paper route.

What object am I studying?
  A paper claim, equation, concept, or systems bottleneck.

What should I do?
  Pick/confirm the object, make a prediction, inspect the mapped route, or open the lab.

What evidence will I get?
  Equation, code witness, demo measurement, source/caveat, observation ledger.

Where next?
  Efficient Attention concept, KV-cache lab, Graph route, object room preview, or saved study route.
```

This slice is high leverage because it connects the product’s most important promises:

* paper-to-concept mapping
* object-centered learning
* role lenses
* Living Notebook Lab design language
* prediction-first demos
* source/evidence grounding
* study memory
* reusable shell contract

The implementation agent should favor a real vertical slice over a broad component abstraction. Extract the shell contract only after the Paper Mapper cockpit works in the browser.

---

## 6. Acceptance criteria

A next slice has moved the app toward the north star only if it passes these checks.

### 1. First viewport has a single dominant learning object

On Paper Mapper’s first viewport, a browser user can identify within five seconds:

```txt
current question
selected paper/claim/equation/object
mapped concept route
primary next action
```

There should not be a generic hero section competing with the learning task. The selected object must be visually dominant through a SelectedObjectBar, route strip, cockpit panel, or equivalent.

---

### 2. Paper Mapper uses the full Question-to-Invariant Loop

The first viewport must visibly contain or lead directly to:

```txt
Question
Object
Prediction
Manipulation / inspection
Evidence
Invariant
Next Move
```

It does not need to perform every step in the first viewport, but the route must be explicit. The user should know how a paper question becomes a tested invariant.

---

### 3. The slice hands off to the existing KV-cache flagship lab without context loss

From Paper Mapper, the user can open the Efficient Attention / KV-cache lab and preserve at least:

```txt
current paper question
selected object
role lens
route step
suggested prediction
AI/object handoff context
```

The destination should not feel like a separate page. It should feel like the next instrument in the same notebook.

---

### 4. Role lenses change the task, not just the copy

Learner, Researcher, Experimenter, and Professor lenses should each expose a meaningfully different next action.

For example:

```txt
Learner:
  predict scaling behavior and repair prerequisite.

Researcher:
  inspect paper claim, assumptions, and source caveat.

Experimenter:
  vary batch, context length, precision, heads, or layers.

Professor:
  open misconception, invariant, and teaching prompt.
```

If role lenses only change labels or decorative text, they fail.

---

### 5. Evidence is concrete and inspectable

The cockpit must show at least two connected representations of the same object, preferably three:

```txt
paper claim / source span
equation
code witness
demo measurement
graph route
saved observation
```

The UI should make clear what is live, what is preview/static, and what is source-backed.

---

### 6. The learner can save or carry the smallest useful observation

After a meaningful interaction or route handoff, the app should preserve a compact observation such as:

```txt
Question:
  Why does serving memory grow with context length?

Object:
  KV-cache memory equation

Prediction:
  doubling context doubles KV memory

Evidence:
  measurement from lab controls

Invariant:
  memory scales with batch × layers × sequence length × KV heads × head dim × precision

Next:
  compare MQA/GQA or paged attention
```

Local state is acceptable for now. Account-backed persistence can come later. The important thing is that the product learns the route shape.

---

### 7. AI handoff packet is object-attached and useful without live AI

The slice should produce a copyable or inspectable AI handoff packet containing:

```txt
current question
selected object
paper/source context
equation or claim
demo state if available
learner prediction or confusion
requested AI task
next on-page action
```

This must be useful even before production AI calls are enabled. It should not be a generic “Ask AI about this” button.

---

### 8. Browser QA passes on desktop and mobile

The implementation agent should verify in browser that:

```txt
desktop first viewport has no clipped panels or hidden primary action
390px mobile has no horizontal overflow
selected object remains visible or quickly reachable
route continuity survives navigation
controls have usable tap targets
live versus preview/static states are labeled
validation/typecheck/lint/build remain passable or known failures are explicitly unchanged
```

Raw-image lint warnings and stale Jest assertion failures may remain only if they are pre-existing and unrelated. The new slice should not add avoidable instability.

---

## 7. Top risks

### 1. Building a beautiful cockpit that does not teach

The first viewport could become visually impressive but fail to make the learner predict, inspect evidence, or carry away an invariant. That would violate the design language. The cockpit must be an instrument, not a poster.

---

### 2. Treating Paper Mapper as a summary feature

A paper-summary flow is not the product. Paper Mapper must map paper confusion to learning objects, prerequisite routes, equations, demos, evidence, and next moves. Otherwise it becomes another shallow research tool.

---

### 3. Extracting abstractions too early

A reusable Living Notebook Lab shell is valuable, but premature abstraction could freeze the wrong pattern. First make the Paper Mapper → KV-cache route feel excellent. Then extract the shell from proven behavior.

---

### 4. Making AI prominent before object context is strong

Generic AI would dilute trust. The AI surface should remain object-attached, source-aware, and bounded by the selected question, claim, equation, demo state, and route.

---

### 5. Letting role lenses fragment the experience

Learner, Researcher, Experimenter, and Professor lenses should clarify the same object from different angles. They should not create four separate products, four layouts, or four unrelated explanations.

---

## Implementation directive

The next implementation agent should pursue this operational goal:

**Make Paper Mapper’s first viewport the canonical “paper question to tested invariant” cockpit, using Efficient Attention and the KV-cache memory lab as the flagship route, with object continuity, prediction, evidence, role lenses, AI handoff, saved observation, and next move visible in the browser.**

A strong implementation is not done when the page looks polished. It is done when a serious user can start with a paper question and end the sitting holding a precise, source-grounded, tested invariant they can use.
