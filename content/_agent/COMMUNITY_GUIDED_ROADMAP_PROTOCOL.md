# Community-Guided Roadmap Protocol

Created: 2026-05-23

## Purpose

Continuous Function should be shaped by serious learners, professors, researchers, practitioners, and builders without becoming a noisy or directionless community.

The operating principle is:

```txt
Open contribution, closed canon.
```

People can help the product learn what to improve. They cannot silently redirect the product, publish canonical content, or turn object rooms into a general forum.

## Product Rule

Every useful suggestion should attach to one of these:

```txt
concept
equation
claim
source span
code witness
demo state
misconception
learning route
platform roadmap object
```

The platform roadmap object exists for whole-product suggestions that are not about one concept:

```txt
route:continuous-function/platform-roadmap
```

This keeps broad advice reviewable without creating a global feed.

## Suggestion Intake

The first implemented contract is:

```txt
lib/communityRoadmapIntake.ts
POST /api/community/roadmap-suggestions
```

This API is contract-only for now:

- it validates and classifies suggestions
- it returns a review packet
- it does not persist
- it does not make anything canonical
- it marks founder/editor decisions where required

The supported contribution types are:

```txt
question
derivation-correction
source-evidence
practitioner-example
counterexample
experiment-result
visualization-idea
misconception-report
route-suggestion
canonical-improvement-proposal
```

## Review Lanes

Suggestions are routed into lanes:

| Lane | Inputs | Output |
| --- | --- | --- |
| Learner pilot | questions, misconception reports | confusion map or route repair |
| Expert review | derivation corrections, source evidence, counterexamples | rigor/source check |
| Practitioner review | code witnesses, system examples, experiment results | runnable or systems witness |
| Demo design review | visualization ideas | prediction-first demo improvement |
| Maintainer review | canonical improvement proposals | mergeable change candidate |
| Founder roadmap | route/platform suggestions | roadmap decision |

## Direction Control

Founder/editor approval is required for:

- platform-scope suggestions
- route suggestions
- canonical improvement proposals
- AI-generated suggestions
- any change that affects product identity, roadmap order, paid boundaries, or canonical content

This lets good people influence the work while preserving the project's taste and north star.

## Noise Controls

The intake rejects or blocks suggestions that are:

- not attached to a valid object or platform roadmap scope
- too thin to review
- missing evidence for source corrections, derivation corrections, counterexamples, or experiment results
- missing an exact proposed change for canonical improvement proposals
- malformed as content object references

The goal is not to maximize submissions. The goal is to maximize reviewable improvements.

## Future Persistence Path

When Clerk/Neon persistence is connected, accepted review packets should become rows attached to app-owned users and object keys.

Likely storage mapping:

- suggestion packet -> `research_threads` or a future `roadmap_suggestions` table
- source/counterexample evidence -> `evidence_refs`
- learner confusion -> `learning_observations` or object-room thread
- accepted canonical proposal -> maintainer queue plus public changelog

Do not add public posting or voting before the review bench exists.
