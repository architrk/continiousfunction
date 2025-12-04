# Content Strategy: Continuous Function

## Vision

**"The resource for ML practitioners who've outgrown tutorials but aren't PhD researchers."**

With Distill.pub defunct and a massive "intermediate wasteland" in ML education, continuousfunction.ai bridges the gap between introductory tutorials and impenetrable research papers. Every explanation includes: **Intuition → Math → Code → Interactive demo**.

---

## The Five Core Concepts

### Priority Topics (Must-Teach)

| Concept | Why It Matters | Common Misconception |
|---------|---------------|---------------------|
| **Grouped Query Attention (GQA)** | De facto standard for production LLMs (Llama 3: 8 KV heads shared across 32 query heads) | "MQA has multiple queries" — it's about sharing key-value heads |
| **Rotary Position Embedding (RoPE)** | Won the positional encoding competition; beautiful geometric interpretation | Students lack complex number intuition for the rotation mechanism |
| **SwiGLU Activation** | Replaced ReLU/GELU in virtually all modern LLMs | It's not just activation — it's a structural gating change. The 2/3 hidden dimension scaling is rarely explained |
| **Mixture of Experts (MoE)** | Powers GPT-4, Mixtral, DeepSeek. 60%+ of top open-source models in 2024-2025 | "8x7B = 56B parameters" — only FFN layers are duplicated |
| **Direct Preference Optimization (DPO)** | Practical alignment bypassing RLHF complexity | Optimize directly on preference pairs without separate reward model |

### Teaching Sequence (12-Week Curriculum)

| Tier | Weeks | Content Focus |
|------|-------|---------------|
| **Foundational** | 1-3 | Original Transformer, MHA, LayerNorm→RMSNorm, ReLU→SwiGLU, Sinusoidal→RoPE |
| **Modern Architecture** | 4-6 | GQA/MQA, KV cache optimization, Sliding Window Attention, MoE |
| **Alignment & Training** | 7-8 | SFT, RLHF conceptual, DPO practical, Constitutional AI |
| **Specialized** | 9-12 | Diffusion (DDPM, score matching), Vision Transformers, Multimodal, Mamba |

### Math Prerequisites (Foundational Modules)

- **Linear Algebra**: Matrix multiplication, eigenvectors for understanding transformations
- **Probability**: Softmax, Gaussian distributions for diffusion
- **Complex Numbers**: Specifically for RoPE (Euler's formula, 2D rotation matrices)
- **Information Theory**: KL divergence for RLHF, cross-entropy loss connections

---

## Pedagogical Approach

### The Universal Pattern: Concrete Before Abstract

Every elite educator (Sanderson, Karpathy, Alammar, Weng, Olah) starts with concrete, visual examples before mathematical formalization.

**Content Sequence for Each Concept:**
1. Hook with an intriguing problem or surprising result
2. Visual representation showing the key insight
3. Progressively build intuition through interaction/animation
4. Reveal mathematical formulation as emerging naturally from the visual
5. Connect to working code implementation
6. Show broader applications and connections

### Multiple Representations

Show the same concept three ways:
- **Algebraically**: `softmax(QK^T/√d)V`
- **Geometrically**: Query vectors "looking at" key vectors
- **As Code**: `torch.softmax(q @ k.T / sqrt_d, dim=-1) @ v`

### Hybrid Top-Down/Bottom-Up Structure

1. **Start top-down**: Show the goal ("Here's GPT-4 answering a question—let's understand every step")
2. **Go bottom-up**: Build foundational concepts progressively
3. **Return top-down**: Reconnect components to the whole system
4. **Iterate**: Spiral back through concepts at increasing depth

---

## Interactive Visualization Patterns

### Exemplar Visualizations to Study

| Project | Tech Stack | Key Innovation |
|---------|-----------|----------------|
| TensorFlow Playground | TypeScript + D3.js | Real-time training feedback loop |
| Transformer Explainer | Svelte + D3.js + ONNX Runtime WASM | GPT-2 running in browser |
| LLM Visualization (Bycroft) | Custom WebGL | Full 3D architecture with every operation visible |
| CNN Explainer | Svelte + D3.js | Multi-level abstraction with smooth transitions |

### Effective Interaction Patterns

| Pattern | Description | Best For |
|---------|-------------|----------|
| **Progressive disclosure** | Start with overview, allow drill-down | Complex architectures |
| **Direct manipulation** | Sliders for continuous parameters | Hyperparameter intuition |
| **Linked views** | Hover in one view highlights related elements | Equation ↔ visualization |
| **Animation for process** | Show temporal sequence of operations | Attention flow, gradient descent |
| **Real-time computation** | Run models in browser, show live results | Building intuition through experimentation |
| **Scroll-driven narrative** | Synchronized text + visualization state changes | Long-form explanations |

### Visualization by Concept Type

- **Matrix operations**: Animated heatmaps with hover-revealed cell values
- **Attention patterns**: Interactive token-to-token connections
- **Gradient flow**: Color-coded magnitude flowing backward through diagrams
- **Loss landscapes**: 3D surfaces with optimization path tracing (Three.js)
- **Embeddings**: 2D/3D scatter plots with semantic clustering, zoom/filter
- **Tokenization**: Side-by-side text with color-coded token boundaries

---

## Technical Stack

### Primary Stack: Svelte 5 + D3.js + GSAP

**Why Svelte:**
- Reactive by default (perfect for explorable explanations)
- No virtual DOM overhead = better visualization performance
- Built-in transitions/animations
- Battle-tested: CNN Explainer and Transformer Explainer both use Svelte+D3

**D3.js:** Industry standard for data visualization, excellent scale/axis/shape utilities

**GSAP:** Professional-grade animations, ScrollTrigger for scroll-driven effects

**Observable notebooks:** Rapid prototyping before production components

**Three.js:** Reserved for when 3D is essential (architecture viz, embedding spaces)

### Typography System

```css
:root {
  --font-prose: 'Merriweather', Georgia, serif;
  --font-heading: 'Inter', system-ui, sans-serif;
  --font-code: 'JetBrains Mono', 'Fira Code', monospace;
  --text-base: 18px;
  --line-height: 1.6;
  --max-width: 65ch;
}
```

**KaTeX over MathJax** for most use cases—renders synchronously, handles hundreds of expressions.

### Layout Architecture

**Tufte-style layout:**
- Main content column: 65-70 characters wide
- Right margin: ~25% width for sidenotes, citations, small figures
- Mobile: sidenotes become tap-to-reveal pop-ins

**Scrollytelling:** `position: sticky` graphics with Scrollama.js or IntersectionObserver

---

## Information Architecture

```
Home
├── Learning Paths (guided sequences through material)
├── Topics (browseable taxonomy by concept)
├── Playground (interactive experimentation space)
├── Glossary (linked definitions with preview cards)
└── Search (full-text including math expressions)

Each Concept Page:
├── Overview (TL;DR answering "why does this matter?")
├── Prerequisites (linked to relevant concept pages)
├── Main Content (narrative with sidenotes)
├── Interactive Examples (manipulable visualizations)
├── Exercises (self-assessment)
├── Related Concepts (knowledge graph connections)
└── Further Reading (papers, alternative explanations)
```

---

## Content Differentiation

### The "Intermediate Wasteland" Target

**Underexplained topics where we differentiate:**
- Why attention *actually* works (not just the mechanics)
- The intuition behind positional encodings (not just the formulas)
- How backpropagation flows through attention layers
- Why transformers generalize well despite overparameterization
- RLHF/DPO/ORPO alignment—most content is either oversimplified blogs or impenetrable papers
- RAG architecture decisions—when to use RAG vs fine-tuning
- Test-time compute scaling (DeepSeek R1)—almost no educational content exists

### Topics Needing Distill-Style Treatment

1. Comprehensive Transformer attention (existing visualizations are incomplete)
2. How gradients flow through modern architectures
3. How RLHF shapes model behavior (interactive demonstration)
4. Training dynamics—watching models learn in real-time
5. Failure mode exploration—interactive debugging

### Unique Content Types

**Paper walkthroughs:** Interactive paper annotations with synchronized code implementations

**Debugging guides:** Systematic "why isn't my model learning?" decision trees with visualizations

**Theory-practice bridge:** "Here's the paper equation, here's the PyTorch code, here's why they're the same"

---

## Production Workflow

### Time Investment Reality

| Content Type | Time Investment |
|-------------|-----------------|
| Standard blog post (text + static images) | 4-8 hours |
| Post with simple interactive charts | 8-16 hours |
| Jay Alammar-style illustrated explainer | 20-40 hours |
| Distill.pub-quality article | 100+ hours |
| Bartosz Ciechanowski-level article | 200-400+ hours |

### AI Workflow Integration

**AI accelerates ~30-40% of the work**

**Where AI helps:**
- Research synthesis and paper summarization
- First draft generation
- Code boilerplate (D3/Svelte setup)
- Editing and refinement
- CSS/styling

**Where human judgment is essential:**
- Identifying what's confusing about a topic
- Designing the "aha moment" sequence
- Choosing what to visualize and how
- Pedagogical sequencing
- Evaluating whether a visualization actually clarifies

### Weekly Production Rhythm

| Day | Activity | Hours | AI Contribution |
|-----|----------|-------|-----------------|
| Monday | Research synthesis | 3-4 | High |
| Tuesday | Outline + pedagogical structure | 2-3 | Medium |
| Wednesday | Draft writing | 4-5 | Medium |
| Thursday | Visualization design | 2-3 | Low |
| Friday | Visualization coding | 4-6 | Medium |
| Saturday | Integration + polish | 2-3 | Medium |
| Sunday | Review + publish + social | 2-3 | Medium |

**Target output:** Monthly illustrated explainers. Quarterly flagship interactive pieces.

---

## Launch Roadmap

### Phase 1: Foundation (Weeks 1-4)
- [x] Set up Next.js + MDX with KaTeX
- [x] Build reusable visualization components
- [x] Establish visual design system (MATH_COLORS palette)
- [ ] Launch newsletter signup

### Phase 2: First Flagship Content (Weeks 5-12)
- [ ] Comprehensive Transformer attention explainer (landmark piece)
- [ ] Supporting articles: "Why RMSNorm replaced LayerNorm," "The geometry of RoPE"
- [ ] Coordinate launch (Hacker News, Reddit, ML Twitter)

### Phase 3: Establish Cadence (Month 4+)
- [ ] Monthly illustrated explainer
- [ ] Quarterly flagship interactive piece
- [ ] Build knowledge graph connections between concepts

---

## Current Implementation Status

### Completed Pillars
- **Sequence Modeling**: Attention, SSMs, Mamba
- **Optimization**: Gradient descent as physics (SGD, Momentum, Adam, Muon)
- **Generative Physics**: Diffusion and flow matching
- **Geometric DL**: Symmetry and equivariance
- **Mechanistic Interpretability**: Reverse-engineering networks

### Completed Concept Pages
- Optimizers Overview
- AdamW
- Muon

### Visualization Components Built
- `GradientDescentPlayground` - Interactive 1D optimizer demo
- `MuonConceptualDemo` - Matrix orthogonalization visualization
- `PhasePortrait2D` - Vector field visualization
- `TimeSeriesPlot` - Loss curves and time series
- `KernelHeatmap` - Matrix/attention pattern visualization
- `StateTimeline` - Neural state evolution
- `KnowledgeGraph` - D3 force-directed concept graph

### Next Priority Content
1. GQA/MQA explainer with KV cache visualization
2. RoPE geometric intuition with complex number animation
3. SwiGLU activation comparison demo
4. MoE routing visualization
5. DPO vs RLHF comparison
