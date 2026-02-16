# Autonomous Discovery Loop

> Note (2026-02-06): This document describes an earlier automation loop and may not reflect current counts/workflow.
> Prefer `AGENTS.md` and `ORACLE_GUIDE.md` for the current Oracle-first workflow, and `data/foundationsData.ts` for curriculum truth.

## System Architecture

The Continuous Function website operates with an autonomous Oracle-driven discovery loop that continuously expands the knowledge base.

### Loop Phases

```
┌─────────────────────────────────────────────────────────┐
│ 1. ORACLE DISCOVERY (Parallel)                         │
│    Query GPT-5.1-pro: "What's next greatest concept?"  │
│    → Monitor with 2-min sleep intervals                │
│    → Background process continues autonomously          │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓ (When query N completes)
┌─────────────────────────────────────────────────────────┐
│ 2. PARALLEL EXECUTION                                   │
│    A) Extract concept N response                        │
│    B) Launch Oracle query for concept N+1 (parallel!)  │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 3. IMPLEMENTATION                                       │
│    - Update foundationsData.ts                          │
│    - Create/enhance visualizations                      │
│    - Update conceptVisualizationMap                     │
│    - Build and test                                     │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 4. CLAUDE BROWSER REVIEW                                │
│    - Open https://claude.com/chrome                     │
│    - Review implementation for correctness              │
│    - Check visualizations render properly               │
│    - Verify math equations display correctly            │
│    - Test interactive elements                          │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 5. FIX & ITERATE                                        │
│    - Address issues from browser review                 │
│    - Rebuild if needed                                  │
│    - Re-review until perfect                            │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓
                   Loop back to phase 1 (Oracle N+1 already running!)
```

### Current State (2025-12-22 11:45 AM)

**Concepts Added:**
- Concept #18: RoPE (Rotary Position Embeddings) ✓
  - Enhanced visualization with global shift slider
  - Foundation page auto-generated
  - Build successful

**Currently Running:**
- Oracle query for Concept #19 (started 11:30 AM)
  - Model: GPT-5.1-pro (browser mode)
  - Input: 14,350 tokens
  - Status: Processing (40+ min elapsed)
  - Expected: 10-60 min total
  - Criteria: Latest 2024-2025 research, educational gaps, practical impact

**Monitoring:**
- Background script checking every 2 minutes
- Will signal when Oracle completes
- Autonomous execution continues without human intervention

### Oracle Query Strategy

Each Oracle query asks GPT-5.1-pro to analyze:
1. **Current knowledge graph** - All existing concepts and connections
2. **Latest research** - NeurIPS 2024, ICLR 2025, major arXiv papers
3. **Educational gaps** - What's poorly explained but crucial
4. **Practical impact** - Used in frontier models (GPT-4, Claude 3.5, Gemini, Llama 3)
5. **Graph connections** - Bridges existing concepts in interesting ways

### Implementation Pattern

For each new concept:
```typescript
// 1. Add to foundationsData.ts
{
  id: 'concept-id',
  number: N,
  title: 'Full Title',
  shortTitle: 'Short',
  icon: '◎',
  category: 'representation',
  canonicalPapers: [...],
  coreMath: `...LaTeX...`,
  coreEquation: '...',
  whyItMatters: [...],
  missingIntuition: [...],
  prereqs: [...],
  dependents: [],
  color: CATEGORY_COLORS.representation
}

// 2. Create visualization component
components/foundations/ConceptViz.tsx

// 3. Map to concept
conceptVisualizationMap['concept-id'] = ['ConceptViz']

// 4. Foundation page auto-generates via [id].tsx
```

### Browser Review Checklist

When reviewing with Claude browser (https://claude.com/chrome):
- [ ] Foundation page renders correctly at `/foundations/[id]`
- [ ] KaTeX math equations display properly
- [ ] Interactive visualizations load and function
- [ ] Sliders/controls respond smoothly
- [ ] Mobile responsive layout works
- [ ] Papers link to correct URLs
- [ ] Prerequisites/dependents links work
- [ ] Graph visualization includes new concept
- [ ] No console errors
- [ ] Build produces no TypeScript errors

### Monitoring Commands

```bash
# Check Oracle status
oracle status --hours 2 | grep "<session-slug>"

# View Oracle output
tail -f ~/.oracle/sessions/<session-slug>/output.log

# Check signal files
cat /tmp/oracle_19_status.txt

# View monitoring logs
tail -f /tmp/fast_check.log
```

### Emergency Recovery

If Oracle query fails or times out:
```bash
# Check last status
oracle status --hours 2

# Manually run query
oracle --engine browser -m "gpt-5.1-pro" \
  --browser-timeout 50m --wait \
  --file data/foundationsData.ts \
  -p "Your query here"

# Resume from saved response if available
ls ~/.oracle/sessions/ | grep -i "keyword"
oracle session <session-id> --render
```

### Success Metrics

- **Concept Addition Rate:** Target 10-15 concepts/month
- **Quality Bar:** Each concept needs 2-4 days of polish
- **Build Success:** All builds must pass TypeScript checks
- **Browser Review:** Zero errors before marking complete

### Next Concepts (Predicted Queue)

Based on current gaps and Oracle's likely recommendations:
1. **Concept #19:** TBD (Oracle analyzing now)
2. **Concept #20:** Likely candidates:
   - Flash Attention / Efficient Attention
   - Grouped Query Attention (GQA)
   - State Space Models (S4/Mamba details)
   - SwiGLU activations
   - Sparse Autoencoders (SAEs)

### Files Modified Per Concept

Typical change set:
- `data/foundationsData.ts` - Add concept entry
- `components/foundations/[ConceptName]Viz.tsx` - Visualization
- `components/foundations/index.ts` - Export and mapping
- `pages/foundations/[id].tsx` - May need new viz imports
- `pages/index.tsx` - Update concept count
- `pages/foundations/index.tsx` - Update concept count

### Parallel Execution Pattern

```
Time    Oracle Query          Implementation        Browser Review
-----   ----------------      ----------------      ---------------
T+0     Query #19 launched    -                     -
T+30    [Query #19 running]   -                     -
T+40    Query #19 DONE!       -                     -
        Query #20 launched    Implement #19 starts  -
T+50    [Query #20 running]   [Building #19]        -
T+60    [Query #20 running]   #19 complete         Review #19
T+70    [Query #20 running]   Fix issues from review
T+80    Query #20 DONE!       #19 finalized        -
        Query #21 launched    Implement #20 starts -
...     [LOOP CONTINUES]
```

This maximizes parallelism - Oracle queries take 10-60 min, implementations take 30-120 min.

---

**Status:** Loop active as of 2025-12-22 11:45 AM
**User involvement:** Optional - system runs autonomously
**Monitoring:** Check this file for latest status updates
