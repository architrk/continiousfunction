# Oracle Prompt Templates

Reusable prompts for the Continuous Function review loop.

Use these with the browser-backed Oracle workflow:

```bash
./scripts/oracle/run.sh <slug> prompts/oracle-templates/<template>.txt responses/<slug>-YYYYMMDD.md --file <files...>
```

Attach the smallest file set that still contains the truth. For concept work, that usually means:

- `content/_agent/CONCEPT_QUALITY_BAR.md`
- the target `concept.yaml`, `content.mdx`, and `viz.tsx` if present
- nearby prerequisite/downstream concepts
- the relevant shared component or visualization wrapper

Template order:

1. `01-research-misconception-scan.txt`
2. `02-outline-review.txt`
3. `03-math-audit.txt`
4. `04-code-equivalence-audit.txt`
5. `05-visualization-critique.txt`
6. `06-full-publish-review.txt`
7. `07-ui-product-design-review.txt`

Do not ask for a broad idea dump. Ask for the few highest-impact corrections, then encode decisions back into content, code, TODOs, or validators.
