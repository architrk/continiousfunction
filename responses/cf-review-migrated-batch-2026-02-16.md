## Prioritized list of fixes (with file paths)

(Review based on the migrated concept YAML/MDX + viz wrappers in the attached bundle. )

1. **Fix a real math↔code mismatch + missing symbol definitions (attention masking + dims).**

   * `content/domains/attention-transformers/concepts/attention-transformers/content.mdx`
     The causal mask equation currently implies scaling *after* adding the mask, but the code scales first and then adds the mask. With finite masks (e.g., `-1e9`), that’s a correctness gap. Also, key symbols like (d_k) and matrix shapes are not defined.

2. **Clarify the GQA memory claim (ratio is ambiguous) + make KV-cache scaling equation match the code.**

   * `content/domains/attention-transformers/concepts/efficient-attention/content.mdx`
     “Reduced by a factor of (H_{kv}/H_q)” reads like “divide by (H_{kv}/H_q)” (which would be the opposite). Make it explicit: memory becomes ((H_{kv}/H_q)) of full MHA (i.e., reduced by (H_q/H_{kv}\times)). Also, the math says “per layer” while the code includes `layers`; add (L) and optionally batch (B).

3. **Diffusion: make the time indexing consistent with the common convention and tighten the score connection.**

   * `content/domains/generative-models/concepts/diffusion/content.mdx`
     The code prints a “t=0” sample that is *already noised* (because `alpha_bar[0] != 1`). That’s a pedagogical footgun. Also, the “score view” is mentioned but not concretely connected to (\epsilon_\theta).

4. **Tokenization: fix a misleading parameter-count claim (weight tying) + make the unigram code snippet robust and <40 lines.**

   * `content/domains/attention-transformers/concepts/tokenization-vocabulary/content.mdx`
   * `content/domains/attention-transformers/concepts/tokenization-vocabulary/concept.yaml`
     Parameter scaling should mention tied embeddings. Also, the DP snippet is currently 44 lines and will crash if no segmentation exists (since it calls `len(seg)`).

5. **RLHF: prerequisites are off + code covers only reward modeling (not the KL-regularized “policy move”).**

   * `content/domains/alignment/concepts/rlhf/concept.yaml`
   * `content/domains/alignment/concepts/rlhf/content.mdx`
     “scaling-laws” as a prerequisite is weird; “kl-divergence” is the real math dependency. The code is good for Bradley–Terry reward fitting, but it doesn’t demonstrate the KL-regularized “nudge probability mass” idea stated in the intuition/math.

6. **Tabs a11y: add `aria-controls`/`aria-labelledby`, roving tabIndex, and keyboard navigation.**

   * `content/domains/attention-transformers/concepts/attention-transformers/viz.tsx`
   * `content/domains/attention-transformers/concepts/efficient-attention/viz.tsx`
   * `content/domains/generative-models/concepts/diffusion/viz.tsx`
   * `content/domains/alignment/concepts/rlhf/viz.tsx`
     Right now the tabs “work,” but screen readers and keyboard users don’t get the full tab semantics (and arrow-key navigation is missing). Also add a `:focus-visible` style.

7. **Graph quality: reduce “prerequisite inflation,” add missing hubs/bridges, and prioritize migrating linked-but-missing IDs.**

   * Affects concept YAMLs across the six concepts (see diffs).
     Biggest wins: move `efficiency`/`long-context` out of tokenization prerequisites; add “positional-encoding” related link for RoPE; add “score-matching” related link for diffusion; swap RLHF prereq to `kl-divergence`.

---

## Per-concept suggested diffs (minimal edits)

### 1) tokenization-vocabulary

#### `content/domains/attention-transformers/concepts/tokenization-vocabulary/concept.yaml`

```diff
--- a/content/domains/attention-transformers/concepts/tokenization-vocabulary/concept.yaml
+++ b/content/domains/attention-transformers/concepts/tokenization-vocabulary/concept.yaml
@@
 prerequisites:
   - maximum-likelihood
   - representations
-  - efficiency
-  - long-context
 leads_to:
   - attention-transformers
   - efficient-attention
+  - long-context
   - decoding-sampling
   - llm-serving
 related:
   - rope
   - long-context
+  - efficiency
```

Why: tokenization does not *require* efficiency/long-context to be understood; those are consequences/links. This reduces “graph friction” (fewer disabled prereq chips) while keeping navigation.

#### `content/domains/attention-transformers/concepts/tokenization-vocabulary/content.mdx`

````diff
--- a/content/domains/attention-transformers/concepts/tokenization-vocabulary/content.mdx
+++ b/content/domains/attention-transformers/concepts/tokenization-vocabulary/content.mdx
@@
-Tokenization is the (often invisible) step that decides what the model's "atoms" are. If your tokenizer splits `function_name` into 6 pieces, the model must do 6 steps of attention and decoding to handle it. If it gets a single token, it can treat it like one object.
+Tokenization is the (often invisible) step that decides what the model's "atoms" are. If your tokenizer splits `function_name` into 6 tokens, the model must process 6 positions (and at generation time emit 6 tokens) to handle it. If it gets a single token, it can treat it like one object.
@@
-Let the vocabulary be a set of strings (or byte sequences) $\mathcal V$. A tokenizer maps an input string $x$ into a sequence of tokens:
+Let the vocabulary be a set of strings (or byte sequences) $\mathcal V$. A tokenizer maps an input string $x$ into a sequence of tokens (where $n$ is the token count):
 
 $$x = \\mathrm{concat}(t_1,\\dots,t_n), \\qquad t_i \\in \\mathcal V.$$
@@
 If embeddings and output logits both use a $|\\mathcal V|\\times d$ matrix, then token-related parameters scale like:
 
 $$\\mathrm{params}_{\\mathrm{token}} \\approx 2\\,|\\mathcal V|\\,d.$$
 
-So the tokenizer is not just preprocessing: it changes model size, latency, and what patterns become easy to represent.
+If you **tie** input/output embeddings (common in LLMs), this is closer to $|\\mathcal V|\\,d$.
+
+So the tokenizer is not just preprocessing: it changes model size, latency, and what patterns become easy to represent.
@@
 ```python
-import math
-
-def best_unigram_segmentation(x, tok_logp):
-    n = len(x)
-    neg_inf = -1e30
-    dp = [neg_inf] * (n + 1)
-    back = [None] * (n + 1)
-    dp[0] = 0.0
-
-    for i in range(n):
-        if dp[i] <= neg_inf / 2:
-            continue
-        for tok, lp in tok_logp.items():
-            if x.startswith(tok, i):
-                j = i + len(tok)
-                s = dp[i] + lp
-                if s > dp[j]:
-                    dp[j] = s
-                    back[j] = (i, tok)
-
-    out = []
-    j = n
-    while j > 0 and back[j] is not None:
-        i, tok = back[j]
-        out.append(tok)
-        j = i
-    return list(reversed(out)) if j == 0 else None
-
-tok_logp = {
-    "the": math.log(0.08),
-    "there": math.log(0.02),
-    "re": math.log(0.05),
-    "th": math.log(0.06),
-    "e": math.log(0.07),
-    "r": math.log(0.03),
-    "t": math.log(0.02),
-    "h": math.log(0.02),
-}
-
-x = "there"
-seg = best_unigram_segmentation(x, tok_logp)
-print("x:", x)
-print("best segmentation:", seg)
-print("num tokens:", len(seg))
+import math
+
+def unigram_map(x, tok_logp):
+    n, NEG = len(x), -1e30
+    dp, back = [NEG] * (n + 1), [None] * (n + 1)
+    dp[0] = 0.0
+    buckets = {}
+    for tok, lp in tok_logp.items():
+        buckets.setdefault(tok[0], []).append((tok, lp))
+    for i in range(n):
+        if dp[i] <= NEG / 2: 
+            continue
+        for tok, lp in buckets.get(x[i], []):
+            if x.startswith(tok, i):
+                j, s = i + len(tok), dp[i] + lp
+                if s > dp[j]:
+                    dp[j], back[j] = s, (i, tok)
+    if back[n] is None:
+        return None
+    out, j = [], n
+    while j > 0:
+        i, tok = back[j]
+        out.append(tok); j = i
+    return out[::-1], dp[n]
+
+probs = {"the": 0.08, "there": 0.02, "re": 0.05, "th": 0.06, "e": 0.07, "r": 0.03, "t": 0.02, "h": 0.02}
+tok_logp = {t: math.log(p) for t, p in probs.items()}
+x = "there"
+res = unigram_map(x, tok_logp)
+assert res is not None, "No valid segmentation"
+seg, score = res
+print("x:", x)
+print("seg:", seg, "tokens:", len(seg), "logp:", round(score, 3))
````

````

---

### 2) attention-transformers

#### `content/domains/attention-transformers/concepts/attention-transformers/content.mdx`
```diff
--- a/content/domains/attention-transformers/concepts/attention-transformers/content.mdx
+++ b/content/domains/attention-transformers/concepts/attention-transformers/content.mdx
@@
-Given a sequence represented as a matrix $X \\in \\mathbb{R}^{T\\times d_{\\text{model}}}$, form:
+Given a sequence represented as a matrix $X \\in \\mathbb{R}^{T\\times d_{\\text{model}}}$ (where $T$ is sequence length), form:
 
 $$Q = XW_Q,\\quad K = XW_K,\\quad V = XW_V.$$
 
+For a single head, $W_Q,W_K,W_V \\in \\mathbb{R}^{d_{\\text{model}}\\times d_k}$ and $Q,K,V \\in \\mathbb{R}^{T\\times d_k}$. The $\\mathrm{softmax}$ is applied **row-wise** over keys.
+
 Single-head attention is:
 
 $$\\mathrm{Attn}(Q,K,V) = \\mathrm{softmax}\\!\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V.$$
 
 For causal (autoregressive) language modeling, apply a mask $M$ where $M_{ij}=-\\infty$ for $j>i$:
 
-$$\\mathrm{Attn}(Q,K,V) = \\mathrm{softmax}\\!\\left(\\frac{QK^\\top + M}{\\sqrt{d_k}}\\right)V.$$
+$$\\mathrm{Attn}(Q,K,V) = \\mathrm{softmax}\\!\\left(\\frac{QK^\\top}{\\sqrt{d_k}} + M\\right)V,$$
+
+where $M_{ij}=0$ for $j\\le i$ and $M_{ij}=-\\infty$ for $j>i$.
@@
 A standard transformer block (pre-norm) is:
 
 $$\\begin{aligned}
+\\text{Let } H := X \\text{ be the hidden states entering a block.}\\\\
 H' &= H + \\mathrm{MHA}(\\mathrm{LN}(H)) \\\\
 H^{\\text{out}} &= H' + \\mathrm{MLP}(\\mathrm{LN}(H'))
 \\end{aligned}$$
 
+The $1/\\sqrt{d_k}$ factor keeps dot products from growing with dimension, which helps prevent softmax from saturating too early.
+
 The core cost driver is the $T\\times T$ attention matrix: compute and memory scale roughly as $O(T^2)$.
````

(You can also optionally rename `d` → `d_k` in the code snippet, but the above fixes the actual mismatch.)

#### `content/domains/attention-transformers/concepts/attention-transformers/viz.tsx`

```diff
--- a/content/domains/attention-transformers/concepts/attention-transformers/viz.tsx
+++ b/content/domains/attention-transformers/concepts/attention-transformers/viz.tsx
@@
-import { useMemo, useState } from 'react'
+import { useId, useMemo, useState } from 'react'
+import type { KeyboardEvent } from 'react'
@@
 export default function AttentionTransformersViz() {
+  const uid = useId()
   const tabs = useMemo(
@@
   const [active, setActive] = useState<TabId>('geometry')
   const current = tabs.find((t) => t.id === active) ?? tabs[0]
   const Active = current.Component
+
+  const panelId = `${uid}-panel`
+  const tabId = (id: TabId) => `${uid}-tab-${id}`
+  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
+    const idx = tabs.findIndex((t) => t.id === active)
+    if (idx < 0) return
+    let next: TabId | null = null
+    if (e.key === 'ArrowRight') next = tabs[(idx + 1) % tabs.length].id
+    else if (e.key === 'ArrowLeft') next = tabs[(idx - 1 + tabs.length) % tabs.length].id
+    else if (e.key === 'Home') next = tabs[0].id
+    else if (e.key === 'End') next = tabs[tabs.length - 1].id
+    if (!next) return
+    e.preventDefault()
+    setActive(next)
+    requestAnimationFrame(() => document.getElementById(tabId(next!))?.focus())
+  }
@@
       <div className="tabs" role="tablist" aria-label="Attention demos">
         {tabs.map((t) => (
           <button
             key={t.id}
             type="button"
             className={`tab ${t.id === active ? 'active' : ''}`}
             role="tab"
+            id={tabId(t.id)}
             aria-selected={t.id === active}
+            aria-controls={panelId}
+            tabIndex={t.id === active ? 0 : -1}
             onClick={() => setActive(t.id)}
+            onKeyDown={onKeyDown}
           >
             {t.label}
           </button>
         ))}
       </div>
@@
-      <div className="panel" role="tabpanel">
+      <div className="panel" role="tabpanel" id={panelId} aria-labelledby={tabId(active)} tabIndex={0}>
         <Active />
       </div>
@@
         .tab:hover {
           border-color: rgba(99, 102, 241, 0.6);
           color: var(--text-primary);
           transform: translateY(-1px);
         }
+
+        .tab:focus-visible {
+          outline: 2px solid rgba(148, 163, 184, 0.6);
+          outline-offset: 2px;
+        }
```

---

### 3) rope

#### `content/domains/attention-transformers/concepts/rope/concept.yaml`

```diff
--- a/content/domains/attention-transformers/concepts/rope/concept.yaml
+++ b/content/domains/attention-transformers/concepts/rope/concept.yaml
@@
 related:
   - tokenization-vocabulary
   - long-context
+  - positional-encoding
```

#### `content/domains/attention-transformers/concepts/rope/content.mdx`

````diff
--- a/content/domains/attention-transformers/concepts/rope/content.mdx
+++ b/content/domains/attention-transformers/concepts/rope/content.mdx
@@
 RoPE rotates queries/keys by position-dependent angles:
 
-$$\\tilde q_p = R(\\theta_p) q, \\qquad \\tilde k_q = R(\\theta_q) k.$$
+$$\\tilde q_p = R(\\theta_p) q_p, \\qquad \\tilde k_q = R(\\theta_q) k_q.$$
 
 Then the dot product becomes:
 
-$$\\tilde q_p^\\top \\tilde k_q = q^\\top R(\\theta_p)^\\top R(\\theta_q) k = q^\\top R(\\theta_q - \\theta_p) k.$$
+$$\\tilde q_p^\\top \\tilde k_q = q_p^\\top R(\\theta_p)^\\top R(\\theta_q) k_q = q_p^\\top R(\\theta_q - \\theta_p) k_q.$$
@@
 where $d$ is head dimension and $i$ indexes the 2D pairs.
+
+RoPE applies this rotation independently to each 2D coordinate pair $(2i,2i+1)$ of a head, so $d$ is typically even and $i \\in \\{0,\\dots,\\frac d2-1\\}$.
@@
 ```python
 import numpy as np
 
 def R(theta):
     c, s = np.cos(theta), np.sin(theta)
     return np.array([[c, -s], [s, c]])
 
-q = np.array([1.0, 0.2])
-k = np.array([0.3, 1.0])
-w = 0.7  # one frequency, for illustration
-
-for delta in [0, 1, 2, 4, 8]:
-    theta_p = 0.0
-    theta_q = delta * w
-    q_tilde = R(theta_p) @ q
-    k_tilde = R(theta_q) @ k
-    print("delta =", delta, "dot =", float(q_tilde @ k_tilde))
+def rope_dot(q, k, p, qpos, w):
+    return float((R(p * w) @ q) @ (R(qpos * w) @ k))
+
+q = np.array([1.0, 0.2])
+k = np.array([0.3, 1.0])
+w = 0.7  # one frequency, for illustration
+
+for delta in [0, 1, 2, 4, 8]:
+    a = rope_dot(q, k, p=0, qpos=delta, w=w)
+    b = rope_dot(q, k, p=5, qpos=5 + delta, w=w)  # same relative offset
+    print("delta =", delta, "dot =", round(a, 3), "dot (shifted) =", round(b, 3))
````

````

---

### 4) efficient-attention

#### `content/domains/attention-transformers/concepts/efficient-attention/content.mdx`
```diff
--- a/content/domains/attention-transformers/concepts/efficient-attention/content.mdx
+++ b/content/domains/attention-transformers/concepts/efficient-attention/content.mdx
@@
 ### KV cache memory scaling
 
-Per layer, the KV cache stores keys and values for all $T$ positions:
+Across a batch of $B$ sequences and $L$ layers, the KV cache stores keys and values for all $T$ positions:
 
-$$\\mathrm{Mem}_{KV} \\propto T\\cdot H_{kv}\\cdot d_{\\mathrm{head}}\\cdot 2 \\cdot \\mathrm{bytes}.$$
+$$\\mathrm{Mem}_{KV} \\approx B\\cdot L\\cdot T\\cdot H_{kv}\\cdot d_{\\mathrm{head}}\\cdot 2 \\cdot \\mathrm{bytes}.$$
 
 The factor of 2 is for storing both $K$ and $V$.
@@
 This reduces KV cache memory roughly by a factor of $H_{kv}/H_q$ compared to full multi-head attention.
+Equivalently: the KV cache becomes about $(H_{kv}/H_q)$ of full multi-head attention (so it’s reduced by roughly $H_q/H_{kv}\\times$ when $H_{kv} < H_q$).
@@
 ```python
-def kv_cache_gb(T, layers, h_kv, d_head, bytes_per_elem=2):
-    # keys + values
-    elems = layers * T * h_kv * d_head * 2
-    return elems * bytes_per_elem / 1e9
-
-T = 128_000
-layers = 80
-d_head = 128
-
-for h_q, h_kv in [(64, 64), (64, 8), (64, 1)]:
-    gb = kv_cache_gb(T=T, layers=layers, h_kv=h_kv, d_head=d_head, bytes_per_elem=2)  # fp16
-    print(f"Hq={h_q:>2} Hkv={h_kv:>2}  KV cache ~ {gb:6.1f} GB (fp16)")
+def kv_cache_gb(T, layers, h_kv, d_head, batch=1, bytes_per_elem=2):
+    elems = batch * layers * T * h_kv * d_head * 2  # keys + values
+    return elems * bytes_per_elem / 1e9
+
+T, layers, d_head, batch = 128_000, 80, 128, 1
+full = kv_cache_gb(T, layers, h_kv=64, d_head=d_head, batch=batch)
+
+for h_q, h_kv in [(64, 64), (64, 8), (64, 1)]:
+    gb = kv_cache_gb(T, layers, h_kv=h_kv, d_head=d_head, batch=batch)  # fp16
+    print(f"Hq={h_q:>2} Hkv={h_kv:>2}  KV ~ {gb:6.1f} GB  ({gb/full:.1%} of full)")
````

````

#### `content/domains/attention-transformers/concepts/efficient-attention/viz.tsx`
Apply the same tab a11y diff pattern as in `attention-transformers/viz.tsx` (unique ids, `aria-controls`, `aria-labelledby`, roving `tabIndex`, arrow keys, and `:focus-visible`). The file is structurally identical, so this is a straightforward mechanical patch.

---

### 5) diffusion

#### `content/domains/generative-models/concepts/diffusion/concept.yaml`
```diff
--- a/content/domains/generative-models/concepts/diffusion/concept.yaml
+++ b/content/domains/generative-models/concepts/diffusion/concept.yaml
@@
 related:
   - gans
   - vaes
+  - score-matching
````

#### `content/domains/generative-models/concepts/diffusion/content.mdx`

````diff
--- a/content/domains/generative-models/concepts/diffusion/content.mdx
+++ b/content/domains/generative-models/concepts/diffusion/content.mdx
@@
 A common discrete-time forward process (DDPM-style) is:
 
 $$q(x_t\\mid x_0) = \\mathcal N\\!\\big(\\sqrt{\\bar\\alpha_t}\\,x_0,\\ (1-\\bar\\alpha_t)I\\big),$$
 
 where $\\bar\\alpha_t = \\prod_{s=1}^t \\alpha_s$ and $\\alpha_s = 1-\\beta_s$ for a noise schedule $\\beta_s$.
@@
 Training often uses the noise-prediction loss:
 
 $$\\mathcal L = \\mathbb E_{x_0,t,\\epsilon}\\,\\big\\|\\epsilon - \\epsilon_\\theta(x_t,t)\\big\\|^2.$$
 
-The "score" view connects denoising to the gradient of log-density $\\nabla_x\\log p_t(x)$, and flow matching reframes sampling as learning a continuous vector field.
+The "score" view connects denoising to the gradient of log-density $\\nabla_x\\log p_t(x)$. In the DDPM parameterization above, predicting noise also gives (up to a known scale) a score estimate:
+
+$$s_\\theta(x_t,t) \\approx \\nabla_{x_t}\\log p_t(x_t) \\;\\propto\\; -\\frac{\\epsilon_\\theta(x_t,t)}{\\sqrt{1-\\bar\\alpha_t}}.$$
+
+Flow matching reframes sampling as learning a continuous vector field.
@@
 ```python
 import numpy as np
 
 T = 1000
 beta = np.linspace(1e-4, 0.02, T)
 alpha = 1.0 - beta
-alpha_bar = np.cumprod(alpha)
+alpha_bar = np.concatenate([[1.0], np.cumprod(alpha)])  # alpha_bar[0]=1 (no noise)
 
 x0 = np.array([1.0, -1.0])
-for t in [0, 10, 100, 500, 999]:
+for t in [0, 10, 100, 500, 1000]:
     eps = np.random.randn(*x0.shape)
     xt = np.sqrt(alpha_bar[t]) * x0 + np.sqrt(1.0 - alpha_bar[t]) * eps
     print(f"t={t:>3}  xt={np.round(xt, 3)}  noise_std={np.sqrt(1.0 - alpha_bar[t]):.3f}")
````

````

#### `content/domains/generative-models/concepts/diffusion/viz.tsx`
Same tab a11y patch pattern as above (ids + keyboard navigation + `:focus-visible`).

---

### 6) rlhf

#### `content/domains/alignment/concepts/rlhf/concept.yaml`
```diff
--- a/content/domains/alignment/concepts/rlhf/concept.yaml
+++ b/content/domains/alignment/concepts/rlhf/concept.yaml
@@
 prerequisites:
   - maximum-likelihood
-  - scaling-laws
+  - kl-divergence
@@
 related:
   - dpo
   - reward-hacking
+  - scaling-laws
````

#### `content/domains/alignment/concepts/rlhf/content.mdx`

````diff
--- a/content/domains/alignment/concepts/rlhf/content.mdx
+++ b/content/domains/alignment/concepts/rlhf/content.mdx
@@
 ### Reward modeling from comparisons (Bradley-Terry)
 
 Given two candidate outputs $y_a, y_b$ for a prompt $x$, a common likelihood model is:
 
 $$P(y_a \\succ y_b\\mid x) = \\frac{\\exp(r_\\phi(x,y_a))}{\\exp(r_\\phi(x,y_a)) + \\exp(r_\\phi(x,y_b))}.$$
 
+Here $r_\\phi(x,y)$ is a scalar “reward” score. Only **differences** in reward matter (adding a constant to all rewards doesn’t change the probabilities).
+
 ### KL-regularized policy optimization
 
 Let $\\pi_\\theta$ be the policy and $\\pi_0$ a reference model. A standard objective is:
 
 $$\\max_\\theta\\; \\mathbb E_{x,y\\sim\\pi_\\theta}[r_\\phi(x,y)] - \\beta\\,\\mathrm{KL}(\\pi_\\theta(\\cdot\\mid x)\\,\\|\\,\\pi_0(\\cdot\\mid x)).$$
 
 The KL term is not decoration: it is the main knob that trades off "follow preferences" against "stay in-distribution."
+
+For a fixed prompt $x$ and a finite set of candidate outputs, the KL-regularized optimum has a simple “reweighting” form:
+$$\\pi^*(y\\mid x) \\propto \\pi_0(y\\mid x)\\,\\exp\\!\\big(r_\\phi(x,y)/\\beta\\big).$$
@@
 ```python
 import numpy as np
 
-# Pairwise preferences between 4 "responses" (0..3): (a, b) means a preferred over b.
-pairs = np.array([
-    [0, 1],
-    [0, 2],
-    [3, 1],
-    [0, 3],
-    [2, 1],
-])
-
-r = np.zeros(4)
-lr = 0.2
-
-for _ in range(400):
-    a, b = pairs[:, 0], pairs[:, 1]
-    diff = r[a] - r[b]
-    p = 1.0 / (1.0 + np.exp(-diff))  # sigmoid
-    grad = np.zeros_like(r)
-    g = -(1.0 - p)  # d/d(diff) of -log(sigmoid(diff))
-    np.add.at(grad, a, g)
-    np.add.at(grad, b, -g)
-    r -= lr * grad / len(pairs)
-
-print("learned rewards:", np.round(r, 3))
-print("ranking (best to worst):", np.argsort(-r))
+pairs = np.array([[0, 1], [0, 2], [3, 1], [0, 3], [2, 1]])  # a preferred over b
+r = np.zeros(4)
+lr = 0.2
+
+for _ in range(400):
+    a, b = pairs[:, 0], pairs[:, 1]
+    diff = r[a] - r[b]
+    p = 1.0 / (1.0 + np.exp(-diff))  # P(a ≻ b) = sigmoid(diff)
+    g = p - 1.0                      # d/d(diff) of -log(sigmoid(diff))
+    grad = np.zeros_like(r)
+    np.add.at(grad, a, g); np.add.at(grad, b, -g)
+    r -= lr * grad / len(pairs)
+
+r -= r.mean()  # rewards only identifiable up to a constant
+beta = 1.0
+pi0 = np.ones_like(r) / len(r)
+pi_star = pi0 * np.exp(r / beta)
+pi_star /= pi_star.sum()
+
+print("reward scores:", np.round(r, 3))
+print("KL-regularized target policy:", np.round(pi_star, 3))
````

```

#### `content/domains/alignment/concepts/rlhf/viz.tsx`
Same tab a11y patch pattern as above.

---

## Batch-2 migration list (legacy IDs + 1 sentence why each)

These are chosen to (a) eliminate currently-linked-but-not-migrated hubs in the six reviewed concepts, and (b) cover high-traffic LLM workflows end-to-end.

1) **`representations`** — It’s a prerequisite for tokenization and a core hub for embeddings, hidden states, and “what vectors mean.”  
2) **`efficiency`** — Shows up repeatedly (tokenization + efficient attention + diffusion leads_to) and anchors compute/memory tradeoffs.  
3) **`long-context`** — Central hub for RoPE + efficient attention; also a major user destination for modern LLM behavior.  
4) **`decoding-sampling`** — High-traffic practical topic, already a “leads_to” from tokenization and a natural continuation after attention basics.  
5) **`llm-serving`** — High-traffic production topic; directly downstream of efficient-attention and tokenization cost tradeoffs.  
6) **`speculative-decoding`** — Explicit “leads_to” from efficient attention; big real-world latency win and highly searched.  
7) **`scaling-laws`** — Mentioned in current graph and a key conceptual hub tying model size/data/compute to capabilities.  
8) **`kl-divergence`** — RLHF’s core regularizer depends on it; migrating it also strengthens many probability/alignment pages.  
9) **`dpo`** — Directly downstream of RLHF and a top modern alignment method users expect to find.  
10) **`reward-hacking`** — Completes the RLHF story by covering failure modes and why KL/reference constraints matter.  
11) **`vaes`** — A prerequisite for diffusion and a generative-models hub; migrating it removes a major broken-link risk.  
12) **`flow-matching`** — Already in diffusion’s narrative and “leads_to”; migrating it lets you split “diffusion basics” vs “modern continuous-time transport.”

If you want a *single* “best next batch” that also reduces disabled chips immediately, prioritize **representations / efficiency / long-context / decoding-sampling / llm-serving / kl-divergence / vaes / dpo** first, then fill remaining slots with the others.
```

