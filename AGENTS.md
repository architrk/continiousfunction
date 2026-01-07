# Autonomous AI Curriculum: 100 Concepts Powered by Oracle

## Continuous Function: Oracle-Driven Discovery & Development

You are building **Continuous Function** — the definitive 100-concept curriculum for modern AI.

**Oracle is your primary tool.** Use it for EVERYTHING: discovery, development, deepening, connecting, debugging, and refining.

In this repo, **"Oracle" refers to the Codex skill `oracle-browser`** (Oracle CLI in browser mode for GPT-5 Pro).

---

## 🔮 ORACLE-FIRST PHILOSOPHY

**Oracle is not optional. Oracle is the engine.**

| Task | Use Oracle For |
|------|----------------|
| **Discovery** | "What are the next 5 essential concepts?" |
| **Development** | "Write the implementation for concept X" |
| **Deepening** | "Explain the deeper math behind X" |
| **Connecting** | "How does X relate to Y and Z?" |
| **Visualization** | "Design an interactive demo for X" |
| **Debugging** | "Why isn't this visualization working?" |
| **Refinement** | "Improve this explanation for clarity" |
| **Papers** | "Summarize the key insights from paper X" |
| **Code** | "Write the D3/React visualization component" |
| **Math** | "Derive this equation step by step" |

**Rule: When in doubt, ask Oracle.**

---

## 🎯 THE VISION: 100 Concepts That Explain Everything

These 100 concepts should collectively answer:
- How does GPT-4 / Claude / Gemini actually work?
- How does Stable Diffusion / Sora generate images and video?
- How do we align models to be helpful and safe?
- How do we scale training to trillions of tokens?
- How do we interpret what's happening inside?

**Pattern: Intuition → Math → Code → Interactive Demo**

---

## 🔧 CURRENT STATE

**33 concepts implemented** — target: **100 concepts**

Progress: ███████░░░░░░░░░░░░░ 33%

---

## 🔄 THE ORACLE-POWERED WORKFLOW

### EVERY STEP USES ORACLE. No exceptions.

---

### 📍 STEP 1: CONCEPT DISCOVERY (Oracle)

**Run Oracle to discover next concepts:**

```bash
oracle --engine browser --model "gpt-5 pro" -p "You are building 'Continuous Function' - the definitive 100-concept AI curriculum.

CURRENT: 33/100 concepts implemented.

YOUR TASK: Identify the next 5 ESSENTIAL concepts (#34-38).

For EACH concept provide:
1. Number + Title + Positioning
2. Core Math (2-3 LaTeX equations with explanation)
3. Frontier Model Usage (2024-2025)
4. Missing Intuition (what tutorials get wrong)
5. Canonical Papers (2-3 with arXiv URLs)
6. Visualization Ideas (interactive demos)
7. Prerequisites (existing concept IDs)
8. What It Unlocks

Be decisive. Pick the 5 most impactful." --file data/foundationsData.ts
```

**⏰ Oracle takes 20-30 minutes. Wait for completion.**

---

### 📍 STEP 2: CONCEPT DEEPENING (Oracle)

**After discovery, DEEPEN each concept with Oracle:**

```bash
oracle --engine browser --model "gpt-5 pro" -p "I'm implementing Concept #NN: [TITLE] for an interactive AI education site.

Here's what I have so far:
[paste the discovery summary]

Please provide:

1. Extended Math Derivation
  - Step-by-step derivation of the core equations
  - What each term means geometrically
  - Common misconceptions about the math
2. Implementation Details
  - Exact TypeScript interfaces needed
  - Edge cases to handle
  - Numerical stability considerations
3. Visualization Deep Dive
  - Specific D3.js/React approach
  - What should animate and why
  - Slider ranges and defaults
  - Color scheme for clarity
4. Connection Map
  - How this connects to concepts #X, #Y, #Z
  - Shared mathematical structures
  - Learning path implications
5. Teaching Sequence
  - What to show first
  - Where students get confused
  - The 'aha moment' trigger

Go deep. This will be THE explanation of this concept." --file data/foundationsData.ts
```

---

### 📍 STEP 3: IMPLEMENTATION CODE (Oracle)

**Get the actual code from Oracle:**

```bash
oracle --engine browser --model "gpt-5 pro" -p "Write the complete implementation for Concept #NN: [TITLE]

CONTEXT:
- Site uses Next.js + TypeScript + D3.js
- Data lives in data/foundationsData.ts
- Visualizations in components/foundations/
- Follow existing patterns (see attached file)

PROVIDE:

1. foundationsData.ts entry
Complete TypeScript object with:
  - id, number, title, shortTitle, icon
  - category, canonicalPapers
  - coreMath (full LaTeX with explanations)
  - coreEquation (single key formula)
  - whyItMatters (5 points)
  - missingIntuition (5 points)
  - prereqs, dependents, color
2. Visualization Component
Complete React + D3 component:
  - Interactive controls (sliders, toggles)
  - Animated visualization
  - Responsive SVG
  - Styled with CSS-in-JS
  - Educational annotations
3. Index exports
What to add to components/foundations/index.ts
4. Dynamic import
What to add to pages/foundations/[id].tsx

Make it production-ready." --file data/foundationsData.ts --file components/foundations/index.ts
```

---

### 📍 STEP 4: CONCEPT CONNECTIONS (Oracle)

**Map how concepts relate to each other:**

```bash
oracle --engine browser --model "gpt-5 pro" -p "I'm building a knowledge graph of 100 AI concepts.

Currently implemented concepts:
[list concept IDs and titles]

Just added:
- #NN: [Title]
- #NN+1: [Title]
...

Please analyze:

1. Prerequisite Chains
  - What must be understood before each new concept?
  - Are there missing foundational concepts we need?
2. Concept Clusters
  - Which concepts naturally group together?
  - What are the major learning arcs?
3. Bridge Concepts
  - Which concepts connect multiple domains?
  - What are the 'hub' concepts with many connections?
4. Learning Paths
  - Optimal sequence for a beginner?
  - Optimal sequence for someone who knows transformers?
  - Optimal sequence for someone interested in alignment?
5. Gap Analysis
  - What important concepts are still missing?
  - Which tiers are under-represented?

Be comprehensive. This graph is core to the site." --file data/foundationsData.ts
```

---

### 📍 STEP 5: VISUALIZATION REFINEMENT (Oracle)

**Improve visualizations with Oracle:**

```bash
oracle --engine browser --model "gpt-5 pro" -p "I have a visualization for Concept #NN: [TITLE]

Current implementation:
[paste the component code]

Please improve:

1. Pedagogical Effectiveness
  - Is the 'aha moment' clear?
  - What's confusing that could be clearer?
  - What animation would help understanding?
2. Interactivity
  - What controls should be added?
  - What ranges make sense?
  - What should happen on hover/click?
3. Visual Design
  - Color improvements for clarity
  - Typography and labeling
  - Responsive considerations
4. Performance
  - Any optimization opportunities?
  - Memoization suggestions?
5. Code Quality
  - TypeScript improvements
  - React best practices
  - D3 idioms

Provide the improved code." --file [current-component-path]
```

---

### 📍 STEP 6: MATH VERIFICATION (Oracle)

**Verify and deepen the mathematics:**

```bash
oracle --engine browser --model "gpt-5 pro" -p "Verify and deepen the math for Concept #NN: [TITLE]

Current coreMath:
[paste the LaTeX content]

Please:

1. Verify Correctness
  - Are the equations correct?
  - Is the notation consistent?
  - Any errors or typos?
2. Add Derivations
  - How do we get from equation 1 to equation 2?
  - What are the key steps?
3. Geometric Interpretation
  - What does each equation mean geometrically?
  - How would you visualize the math?
4. Edge Cases
  - When does this break down?
  - What are the assumptions?
5. Connections
  - How does this math relate to concept X?
  - Shared structures with other concepts?

Be rigorous but accessible."
```

---

### 📍 STEP 7: PAPER SYNTHESIS (Oracle)

**Extract insights from research papers:**

```bash
oracle --engine browser --model "gpt-5 pro" -p "Synthesize the key papers for Concept #NN: [TITLE]

Papers:
1. [Paper Title 1] - [arXiv URL]
2. [Paper Title 2] - [arXiv URL]
3. [Paper Title 3] - [arXiv URL]

For each paper, extract:

1. Core Contribution
  - What's the main idea in one sentence?
2. Key Equations
  - The 1-2 equations that matter most
3. Surprising Insights
  - What's non-obvious from the paper?
4. Limitations
  - What doesn't the paper address?
5. How It Connects
  - Relationship to other papers/concepts

Then synthesize:
- What's the unified understanding across all papers?
- What's the teaching narrative?
- What visualization would capture the essence?"
```

---

### 📍 STEP 8: QUALITY REVIEW (Oracle)

**Review implemented concepts for quality:**

```bash
oracle --engine browser --model "gpt-5 pro" -p "Review Concept #NN: [TITLE] for quality.

Implementation:
[paste the foundationsData entry]

Visualization:
[paste the component code]

Evaluate:

1. Completeness (1-10)
  - Is everything covered?
  - Missing aspects?
2. Clarity (1-10)
  - Would a smart beginner understand?
  - Jargon that needs explaining?
3. Accuracy (1-10)
  - Math correct?
  - Up-to-date with 2024-2025 research?
4. Visualization Quality (1-10)
  - Does the demo teach effectively?
  - Interaction intuitive?
5. Connections (1-10)
  - Well-linked to other concepts?
  - Prerequisites make sense?

Provide specific improvements for anything below 8."
```

---

### 📍 STEP 9: BATCH PLANNING (Oracle)

**Plan the next implementation batch:**

```bash
oracle --engine browser --model "gpt-5 pro" -p "Plan the next implementation batch for Continuous Function.

Current state:
- Implemented: [list of concept IDs]
- Researched but not implemented: [list]
- Total: NN/100

Consider:
- Tier balance (foundations, generative, scaling, etc.)
- Prerequisite dependencies
- Implementation complexity
- Educational impact

Recommend:
1. Which 5 concepts to implement next?
2. In what order?
3. Which need visualizations vs. text-only first?
4. Estimated complexity for each?
5. Any new concepts to discover first?

Be strategic. We're building the best AI curriculum." --file data/foundationsData.ts
```

---

### 📍 STEP 10: CONTINUOUS DISCOVERY (Oracle)

**After every implementation, discover more:**

```bash
oracle --engine browser --model "gpt-5 pro" -p "Continuous Function now has NN/100 concepts.

Just implemented:
- #X: [Title]
- #Y: [Title]
...

Analyze what's next:

1. Gap Analysis
  - What essential concepts are still missing?
  - Which tiers need more coverage?
2. Next 5 Concepts
  - Recommend concepts #NN to #NN+4
  - Prioritize by educational impact
3. Emerging Topics
  - Any 2024-2025 developments we should add?
  - Papers published in last 3 months worth covering?
4. Connection Opportunities
  - New links between existing concepts?
  - Concepts that should reference each other?

Keep the discovery loop running." --file data/foundationsData.ts
```

---

## 🔁 THE CONTINUOUS LOOP

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│   │ DISCOVER │───▶│  DEEPEN  │───▶│IMPLEMENT │             │
│   │ (Oracle) │    │ (Oracle) │    │ (Oracle) │             │
│   └──────────┘    └──────────┘    └──────────┘             │
│        │                               │                    │
│        │         ┌──────────┐          │                    │
│        │         │  REVIEW  │◀─────────┘                    │
│        │         │ (Oracle) │                               │
│        │         └──────────┘                               │
│        │               │                                    │
│        │         ┌──────────┐                               │
│        └────────▶│ CONNECT  │                               │
│                  │ (Oracle) │                               │
│                  └──────────┘                               │
│                        │                                    │
│                        ▼                                    │
│                  ┌──────────┐                               │
│                  │  REPEAT  │───────────────────────────────┘
│                  └──────────┘
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Every box uses Oracle. There is no step without Oracle.

---

## 📋 ORACLE USAGE CHECKLIST

For EVERY concept, use Oracle for:

- [ ] **Discovery**: What is this concept?
- [ ] **Deepening**: Explain the math in detail
- [ ] **Papers**: Synthesize the key research
- [ ] **Code**: Write the data entry
- [ ] **Visualization**: Design the interactive demo
- [ ] **Implementation**: Write the React/D3 component
- [ ] **Connections**: How does it link to others?
- [ ] **Review**: Is the quality high enough?
- [ ] **Refinement**: How can we improve it?

**9 Oracle queries per concept is normal. Don't skimp.**

---

## ⏰ TIMING EXPECTATIONS

| Oracle Query Type | Expected Time |
|-------------------|---------------|
| Discovery (5 concepts) | 20-30 min |
| Deepening (1 concept) | 15-20 min |
| Implementation code | 15-20 min |
| Visualization design | 15-20 min |
| Paper synthesis | 15-20 min |
| Connection mapping | 10-15 min |
| Quality review | 10-15 min |

**Oracle is slow. That's okay. Quality takes time.**

While Oracle runs:
- Document previous responses
- Update AUTONOMOUS_LOOP_STATUS.md
- Review existing implementations
- Plan next queries

---

## 🚨 CRITICAL RULES

1. **ORACLE FOR EVERYTHING** — No task is too small for Oracle
2. **QUEUE MULTIPLE QUERIES** — While one runs, prepare the next
3. **SAVE EVERY RESPONSE** — `responses/` directory is your knowledge base
4. **BE PATIENT** — 20-30 min per query is normal and worth it
5. **ITERATE WITH ORACLE** — First response not perfect? Query again
6. **TRUST ORACLE'S DEPTH** — It knows the papers, the math, the code
7. **NEVER SKIP ORACLE** — "I'll just do this myself" = quality drops
8. **DOCUMENT THE JOURNEY** — Every Oracle session in AUTONOMOUS_LOOP_STATUS.md

---

## 🎯 ORACLE QUERY TEMPLATES

Save these for quick access:

### Quick Discovery
```bash
oracle --engine browser --model "gpt-5 pro" -p "Next 5 essential AI concepts for our 100-concept curriculum. Currently at NN/100." --file data/foundationsData.ts
```

### Quick Implementation
```bash
oracle --engine browser --model "gpt-5 pro" -p "Write complete foundationsData.ts entry + React visualization for Concept #NN: [TITLE]" --file data/foundationsData.ts
```

### Quick Deepening
```bash
oracle --engine browser --model "gpt-5 pro" -p "Deep dive on the math and intuition for [CONCEPT]. Derive equations, explain geometry, identify misconceptions."
```

### Quick Connection
```bash
oracle --engine browser --model "gpt-5 pro" -p "How does [CONCEPT A] connect to [CONCEPT B] and [CONCEPT C]? Shared math structures? Learning path?"
```

### Quick Review
```bash
oracle --engine browser --model "gpt-5 pro" -p "Review this implementation for quality. Score 1-10 on completeness, clarity, accuracy. Suggest improvements." --file [path]
```

---

## 🏁 START NOW

**Current: 33/100 concepts (33%)**
**Remaining: 68 concepts**
**Oracle queries needed: ~600+ (68 concepts × 9 queries each)**

This is a marathon of Oracle queries. Embrace it.

1. Run Oracle for discovery
2. Run Oracle for deepening
3. Run Oracle for implementation
4. Run Oracle for connections
5. Run Oracle for review
6. Save everything
7. Repeat until 100

**Oracle is your co-author. Use it relentlessly.**
