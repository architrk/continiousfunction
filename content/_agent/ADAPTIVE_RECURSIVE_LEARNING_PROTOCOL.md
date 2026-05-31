# Adaptive Recursive Learning Protocol

Created: 2026-05-23

## Purpose

Continuous Function should personalize learning without forcing people into rigid buckets like student, researcher, professor, or professional.

Those labels can be useful shortcuts in the interface, but the deeper product should adapt to the learner's current evidence:

```txt
selected object
current question
prediction result
confidence movement
confusion mark
demo manipulation
source/code inspection
saved note
route progress
```

The goal is a teacher-like experience: infer where the learner is, ask only the one question that matters, and choose the next object, bridge, example, demo state, or source span that most reduces confusion.

## Operating Principle

```txt
Personalize from object-level evidence, not fixed personas.
```

A learner may be a beginner on one object, a researcher on another, and a practitioner on a third. The platform should adapt locally.

## First Contract

The first implemented contract is:

```txt
lib/adaptiveLearningLoop.ts
POST /api/learning/adaptive-loop
```

This API is contract-only for now:

- it accepts a route snapshot and compact learning signals
- it normalizes every signal to a content object
- it infers a current learning posture
- it returns the next experience action
- it can draft a non-canonical improvement proposal when repeated friction appears
- it does not persist
- it does not call a live model
- it does not make content, route, demo, or prompt changes automatically

## Signals

Supported signal types:

```txt
question-asked
confusion-marked
helpful-marked
prediction-submitted
prediction-revealed
confidence-reported
demo-manipulated
source-opened
code-opened
note-saved
route-abandoned
concept-revisited
```

Each signal should attach to a content object key:

```txt
concept:...
equation:...
claim:...
source-span:...
code:...
demo:...
misconception:...
paper:...
route:...
```

If a signal does not carry an object key, the API may use the current selected object from the route snapshot. If neither exists, the signal is blocked.

## Learner Model

The first learner model is deliberately small:

```txt
posture:
  orientation
  repair
  prediction-repair
  mechanism-testing
  research-grounding
  consolidation

confidence trend:
  unknown
  up
  down
  flat
```

This is not a permanent profile. It is the current teaching stance.

Examples:

- A wrong prediction creates `prediction-repair`.
- A confusion mark creates `repair`.
- Source inspection creates `research-grounding`.
- Demo/code interaction creates `mechanism-testing`.
- A helpful mark or saved note creates `consolidation`.

## Next Experience Actions

The loop can ask for one of these actions:

```txt
start-route
ask-one-calibrating-question
show-prerequisite-bridge
contrast-prediction-with-invariant
run-variable-change-witness
open-source-grounded-room
offer-harder-adjacent-object
```

This is the practical personalization surface. The frontend and AI layer should use this packet to decide what to show next.

## Recursive Improvement

Repeated object-level friction can draft an improvement:

```txt
signals -> learner model -> next experience -> aggregate friction -> improvement draft -> review queue -> canonical update
```

Examples:

- repeated wrong predictions -> improve demo feedback
- repeated confusion -> rewrite intuition or add a prerequisite bridge
- route abandonment -> review route order
- repeated source questions -> add a source-grounded clarification

The optimization target is durable understanding, not raw engagement.

## Canonical Boundary

Adaptive improvement drafts are non-canonical.

They must enter the review process before changing:

- canonical atlas content
- learning route order
- demos
- AI prompts
- public object-room summaries
- generated code or examples

## Agent Boundary

A Codex-style backend agent can eventually help, but only behind a review gate:

```txt
accepted review item
-> isolated branch/worktree
-> generated patch
-> tests and content validation
-> human/founder review
-> merge
-> changelog
```

The agent should not silently rewrite the app based on implicit learner behavior.

## Privacy Boundary

Private learner signals can personalize the learner's experience.

Only anonymized aggregate patterns should become product-improvement proposals. Individual learner confusion should not be exposed publicly without explicit consent.

## How This Fits The Platform

This protocol sits between:

- account learner memory
- object rooms
- AI tutor context
- community roadmap suggestions
- maintainer review queue
- canonical atlas updates

It gives Continuous Function the beginning of recursive self-improvement while preserving trust, review, and founder direction.
