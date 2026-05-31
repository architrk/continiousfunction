# High-Signal AI Learning Platform Roadmap

Created: 2026-05-21

## One-Sentence Vision

Continuous Function should become a high-signal AI-era learning commons for the mathematics of modern AI: part atlas, part notebook, part lab, part seminar room, and part careful AI tutor.

The product is not a course site plus a chatbot plus a forum. The product is a place where learners, students, engineers, professors, researchers, practitioners, and AI systems collaborate around exact learning objects until difficult ideas become understandable.

## Product Thesis

The core unit is the learning object:

```txt
concept -> equation -> claim -> source span -> code witness -> demo state -> misconception -> learning route
```

Every personal note, community question, AI answer, expert correction, saved observation, source check, and content-improvement proposal should attach to one of those objects.

This keeps the platform from becoming noisy. It also gives AI the context it needs to be useful without pretending to know everything.

## What People Should Feel

Students should feel: "I can finally enter this field without being humiliated by missing prerequisites."

Engineers should feel: "This connects the math to systems, code, model behavior, and practical tradeoffs."

Researchers should feel: "This helps me read papers faster without flattening the hard parts."

Professors should feel: "This is rigorous enough to teach with and structured enough to annotate or assign."

Expert contributors should feel: "My correction, example, or derivation lands exactly where it helps."

The creator should feel: "This can become financially sustainable without betraying the learning mission."

## Core Experience

Every serious session should follow this loop:

1. Bring a question, paper, concept, equation, model behavior, or production symptom.
2. Map it to precise learning objects.
3. Study intuition, math, code, and demo evidence.
4. Make a prediction before reveal.
5. Ask AI about the exact selected object.
6. Save the smallest useful observation.
7. Join or inspect a high-signal object room.
8. Leave with a next repair concept, experiment, source, or practice task.

The public atlas remains generous. The platform layer adds memory, personalization, collaboration, AI, and durable research workflows.

## Three Spaces

### 1. Personal Study Space

Private by default:

- current question
- saved learning route
- selected object
- AI tutor context
- notes
- prediction history
- misconception diagnosis
- confidence and goal
- next repair concept
- compact observations across devices

This is where personalization starts. The platform should know what the learner is trying to understand, what they have already tested, and what next move would reduce confusion.

### 2. Object Room

Shared only when useful:

- equation room
- claim room
- demo room
- paper-span room
- code-witness room
- misconception room
- route room

Each room has structured contribution types:

- question
- derivation correction
- source evidence
- practitioner example
- counterexample
- experiment result
- visualization idea
- AI summary
- canonical improvement proposal

No generic infinite feed. No popularity contest. The room exists to improve understanding of one object.

### 3. Canonical Atlas

Reviewed and stable:

- concept explanations
- source-grounded claims
- validated demos
- code witnesses
- practice shells
- curated learning paths
- distilled object-room insights

AI and community can propose changes, but canonical content changes only after review.

## AI Roles

AI should behave like a careful research tutor and editorial assistant, not a generic content machine.

Initial roles:

- Tutor: explains selected objects with intuition before notation.
- Misconception detector: diagnoses wrong predictions and shaky answers.
- Route planner: turns a paper or goal into prerequisites and next concepts.
- Paper mapper: maps paper spans to concepts, claims, equations, and demos.
- Source checker: asks whether a claim is supported by supplied sources.
- Visualization designer: proposes demo sketches and image directions.
- Practice generator: creates targeted checks based on current confusion.
- Debate summarizer: turns object-room discussion into resolved insight, open disagreement, evidence, and next experiment.
- Professor-review assistant: flags symbol gaps, hidden assumptions, bad analogies, or derivation jumps.

Rules:

- AI output is a draft, note, or recommendation.
- AI does not silently become canonical atlas content.
- AI answers must carry object context and source boundaries.
- Private learner data is not mixed into public retrieval.
- Expensive model calls are rate-limited by user, workspace, and object.

## High-Signal Community System

The community should reward contribution quality, not activity volume.

Quality signals:

- clarified a learner's confusion
- supplied a source
- corrected a derivation
- reproduced an experiment
- added a useful practitioner example
- improved a visualization or demo
- resolved a misconception
- helped users succeed on a prediction or practice task
- proposed a better route through prerequisites

Anti-signals:

- unsupported claims
- aggressive tone
- vague hot takes
- engagement bait
- repeated answers already resolved in the room
- arguments that ignore evidence
- AI-generated filler without source or object grounding

Moderation primitives:

- object rooms instead of feeds
- slow thoughtful posting for high-stakes rooms
- contribution type required
- evidence required for claim correction
- AI summaries to reduce repetition
- expert review for canonical changes
- clear conduct rules
- invite-only early cohorts

## Recursive Improvement Loop

Continuous Function should learn how to teach better.

Capture explicit signals:

- "I am confused"
- "This helped"
- confidence before and after
- quiz and practice results
- prediction correctness
- preferred explanation style
- stuck reason

Capture implicit signals carefully:

- where readers stop
- which equations trigger questions
- which demos are manipulated
- which predictions fail repeatedly
- which routes are abandoned
- which concepts are revisited before success
- which discussion summaries are opened or ignored

Turn signals into improvement proposals:

- rewrite intuition
- split a concept
- add a prerequisite bridge
- create a smaller code witness
- add a demo failure regime
- generate a better visual
- create a practice check
- request professor review
- add a practitioner example
- improve route ordering

Approval flow:

```txt
signals -> AI diagnosis -> draft improvement -> human/expert review -> validation -> canonical update
```

The optimization target is durable understanding, not engagement.

## Sustainable Financial Model

The public atlas should stay generous because trust and reach matter.

Paid value should come from durable platform features:

- cross-device learner memory
- advanced AI tutoring and higher model usage
- private paper mapping
- personal research library
- team or class workspaces
- professor dashboards
- lab reading groups
- practitioner/company learning spaces
- guided cohorts and workshops
- expert-reviewed learning tracks

Do not start with ads. Do not make the platform feel like a marketplace. Do not charge for half-formed community access.

The money should support:

- AI/API costs
- hosting and storage
- expert review
- better content and demos
- scholarships or free access where appropriate
- the creator's ability to work deeply on the project

## Roadmap

### Phase 0: Clarify And Prepare (Now)

Goal: make the vision operational.

Actions:

1. Keep this roadmap, `PRODUCT_NORTH_STAR.md`, `PLATFORM_FOUNDATION.md`, `AI_FIRST_PRODUCT_DIRECTION.md`, and `DESIGN_LANGUAGE.md` aligned.
2. Pick one flagship path as the proof of platform value.
3. Define 5-10 target early users: serious students, ML engineers, one professor/TA, one researcher, one practitioner.
4. Create a short founder note: what Continuous Function is, who it is for, and what kind of feedback is wanted.
5. Prepare a private early-access list before opening any broad community.
6. Choose the first paid hypothesis, but do not implement billing yet.

Recommended flagship path:

```txt
paper question -> Paper Mapper -> concept route -> selected equation -> prediction-first demo -> AI help -> saved observation -> object room -> next repair concept
```

### Phase 1: Make One Loop Excellent

Goal: prove that the core experience is lovable without broad community.

Build:

- one exceptional concept route around AI systems/math
- object-attached AI prompts on concept, equation, code, demo, and paper spans
- compact saved observation cards
- one route resume surface
- one practice shell
- one high-quality Paper Mapper flow
- one distilled discussion mock surface, even if data is local/static first

Validation:

- watch 3-5 users try to understand the same paper/question
- record where they get stuck
- capture which AI prompts help
- identify the first object rooms worth making real
- keep browser QA on desktop and mobile

Success:

- users can explain the central invariant after the route
- users know what to do next
- users ask for saved memory or continuation

### Phase 2: Account-Backed Memory

Goal: turn the site into a platform without launching a noisy social layer.

Build:

- Vercel full-stack preview
- Clerk sign-in
- Neon/Drizzle migration execution
- server-side authorization helpers
- protected `/me` or `/library`
- import anonymous local route snapshots after login
- save route snapshots and observations to Postgres
- save object-specific private notes
- store AI run summaries by object

Do not build:

- public profiles
- global feeds
- full billing
- realtime rooms
- broad uploads

Success:

- a learner can start on one device, continue on another, and resume the exact object/question/evidence/next-step state.

### Phase 3: AI Companion Production

Goal: make AI a serious page-aware tutor, not a generic assistant.

Build:

- production AI gateway or Vercel API routes with server-side secrets
- rate limits by user/workspace/object
- model-call logging policy that protects privacy
- selected text/equation/code/demo-state attachment
- task modes: explain, quiz, connect prerequisite, turn into code, diagnose misconception
- compact AI run summaries saved to object memory
- fallback prompt-copy mode when gateway is unavailable

Success:

- AI responses are more useful because they know the object.
- answers end with one on-page action.
- users trust the AI because it shows boundaries and sources.

### Phase 4: Object Rooms V1

Goal: introduce community as structured learning, not chatter.

Build:

- private/invite-only object rooms
- contribution types
- evidence/source fields
- resolved insight and open question summary
- AI debate summarizer
- expert correction flag
- maintainer review queue
- object-room links from concept pages and Paper Mapper

First room types:

- claim room
- equation room
- demo observation room
- paper span room
- misconception room

Success:

- one professor correction improves a canonical page
- one practitioner example improves intuition
- one student confusion report creates a better prerequisite bridge
- AI summary reduces repeated discussion

### Phase 5: Small Cohorts And Institutional Use

Goal: test whether schools, labs, and serious groups can use the platform.

Build:

- workspace invites
- small class or reading-group routes
- professor/TA dashboard for aggregate confusion by object
- assignment links to routes and demos
- private notes and public object-room contributions
- exportable reading plan

Avoid surveillance:

- do not expose private learner notes to instructors by default
- show aggregate confusion and progress around objects
- require clear consent for shared observations

Success:

- a professor or TA can assign a route and use object-level confusion to guide discussion.
- a lab can read a paper and leave with a shared prerequisite map and open questions.

### Phase 6: Sustainable Paid Product

Goal: support the project financially while protecting the mission.

Likely tiers:

- Free: public atlas, demos, local-only route state, limited AI prompt-copy/offline mode.
- Personal Pro: saved memory, advanced AI usage, private notes, route library, paper mapping history.
- Study Group: shared workspaces, object rooms, reading routes, group notes.
- Institution/Lab: class/lab spaces, admin controls, dashboards, higher AI limits, expert-reviewed tracks.
- Cohorts/Workshops: guided deep dives, live seminars, expert review, structured projects.

Charge for recurring compute and durable workflow value, not for access to the idea of learning.

### Phase 7: Recursive Self-Improvement System

Goal: make the platform improve education quality over time.

Build:

- learning signal schema
- confusion heatmaps by object
- prediction accuracy by demo
- AI improvement proposal queue
- expert review dashboard
- content change experiments measured by understanding
- source-grounded content generation workflow
- visualization proposal workflow

Success:

- the platform identifies its weakest explanations.
- AI drafts improvements.
- humans review.
- validated changes make future learners succeed faster.

## What To Do Immediately

This is the next practical sequence.

1. Write the public-facing founder vision page in plain language.
   It should say: Continuous Function is a high-signal AI learning commons for modern AI mathematics.

2. Pick the first flagship route.
   Recommended: attention serving / long context / efficient attention / SSM hybrids, because it already connects papers, systems, equations, demos, and route state.

3. Build the first "object room" as a non-networked prototype.
   Put it on one concept page as a structured surface:
   - best explanation
   - student question
   - professor note
   - practitioner example
   - AI summary
   - open question
   - source-backed correction

4. Make the AI companion production-smoke real.
   The current contract exists; next prove live model calls against selected object context.

5. Create account-backed route memory.
   Do the Clerk/Neon/Drizzle skeleton before public community. Memory is the spine.

6. Recruit a tiny serious cohort.
   Start with 5-10 people. Ask them to use one route and tell you exactly where their understanding broke.

7. Start a private expert review lane.
   Ask one professor, TA, PhD student, or experienced practitioner to review one object, not the whole site.

8. Create a contribution rubric.
   Contributions must be attached to objects and marked as question, source, correction, example, experiment, visualization idea, or route suggestion.

9. Define the first paid beta promise.
   Example: "Personal Pro saves your learning routes, gives page-aware AI help, and lets you build a private AI-math research notebook."

10. Keep the next three months ruthlessly narrow.
   One great loop, a tiny cohort, real memory, object-attached AI, and one structured community surface are enough.

## Operating Principles

- Depth before breadth.
- Object rooms before feeds.
- Saved evidence before social identity.
- AI beside the learner, not over the learner.
- Human review before canonical changes.
- Financial sustainability without ads or engagement bait.
- Institutions get aggregate object-level insight, not private learner surveillance.
- The public atlas remains generous.
- Every feature must answer: does this make the next thought easier?

## Near-Term Non-Goals

- General social network.
- Viral feed.
- Public profile status games.
- Large-scale open comments.
- Billing before saved learner memory.
- Realtime collaboration before asynchronous object rooms.
- Unreviewed AI-generated canonical content.
- Broad paper upload platform before source-span privacy and processing rules.

## The First Milestone To Aim For

The first milestone is not "launch community."

It is:

```txt
One invited learner can bring a paper question, follow a route, inspect an equation,
make a prediction, ask AI about the selected object, save the observation,
see a distilled object-room discussion, and return tomorrow with context preserved.
```

When that works, Continuous Function starts behaving like the platform it wants to become.
