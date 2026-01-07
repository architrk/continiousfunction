# Browser Review Checklist - Concepts #19-21

**Dev Server:** http://localhost:3001
**Review Tool:** https://claude.com/chrome

## Concepts to Review

### Concept #18: RoPE (Rotary Position Embeddings)
- **URL:** http://localhost:3001/foundations/rope
- **Visualization:** RoPEViz with global shift slider
- **Check:**
  - [ ] Global shift slider works (range -5 to +5)
  - [ ] Dot product calculation updates in real-time
  - [ ] "Key Insight" box appears when shift ≠ 0
  - [ ] Math equations render correctly (θ, rotation matrices)
  - [ ] Complex number visualization shows phase differences
  - [ ] Mobile responsive layout works

### Concept #19: Efficient Attention
- **URL:** http://localhost:3001/foundations/efficient-attention
- **Visualization:** KVCacheDashboard
- **Check:**
  - [ ] All sliders work (context length, layers, heads, batch size, dtype, attention type)
  - [ ] KV cache memory calculation updates correctly
  - [ ] GQA memory savings shown accurately
  - [ ] Attention type selector changes KV heads properly
  - [ ] Memory metrics display in GB
  - [ ] Insight box explains linear growth with context length
  - [ ] Console has no errors

### Concept #20: Speculative Decoding
- **URL:** http://localhost:3001/foundations/speculative-decoding
- **Visualization:** SpeculativeDecodingViz
- **Check:**
  - [ ] Draft quality slider affects acceptance rate
  - [ ] Draft length slider changes number of tokens
  - [ ] Resample button generates new token sequences
  - [ ] Acceptance probability α = min(1, p/q) calculated correctly
  - [ ] Accepted/rejected tokens visually distinguished (green vs red)
  - [ ] Acceptance rate percentage updates
  - [ ] Theoretical speedup formula works
  - [ ] Insight box explains lossless property
  - [ ] Token cards show draft prob, target prob, and acceptance prob

### Concept #21: LLM Serving
- **URL:** http://localhost:3001/foundations/llm-serving
- **Visualization:** ServingLatencyViz
- **Check:**
  - [ ] Prompt length slider affects TTFT
  - [ ] Output length slider affects total latency
  - [ ] Batch size slider affects both TTFT and TPOT
  - [ ] Timeline visualization shows prefill vs decode proportions
  - [ ] TTFT + (T_out - 1) × TPOT formula renders correctly
  - [ ] Prefill vs Decode comparison cards show different workload characteristics
  - [ ] Compute intensity metrics update (prefill high, decode low)
  - [ ] Metrics grid shows TTFT, TPOT, and total latency
  - [ ] Insight box explains compute-bound vs bandwidth-bound distinction

## General Checks

### Navigation
- [ ] Homepage shows "21 Core Concepts" button
- [ ] Foundations index page shows "21 core mathematical concepts"
- [ ] Concept cards display correctly with icons (⚙, ⏩, ⚡)
- [ ] Concept map/graph includes all 21 concepts
- [ ] Navigation between concepts works

### Math Rendering
- [ ] All KaTeX equations render without errors
- [ ] Core equations display prominently
- [ ] Inline math symbols render correctly
- [ ] No "undefined" or broken LaTeX strings

### Papers & Content
- [ ] Canonical papers section shows correct citations
- [ ] "Why it matters" bullets are readable and informative
- [ ] "Missing intuition" section provides genuine insights
- [ ] Prerequisites and dependencies are listed

### Performance
- [ ] Page load time < 3 seconds
- [ ] No console errors or warnings
- [ ] Interactive controls respond immediately
- [ ] No layout shift during loading
- [ ] Dynamic imports work (no SSR issues)

## Issues Found

*Document any issues here:*

---

## Next Steps After Review

1. Fix any issues found
2. Monitor Oracle #22 completion
3. Implement concept #22 based on Oracle response
4. Launch Oracle #23 in parallel
5. Continue autonomous loop
