I’ll give you a *concept map* rather than a giant bibliography: ~16 core mathematical ideas that, together, explain most of what’s going on in GPT‑4 / Claude / Gemini / Llama / Stable Diffusion / Sora‑style systems.

For each concept:

* **Canonical paper(s)**
* **Core math** (key equation / principle)
* **Why it matters for modern models**
* **What intuition is still missing**
* **Connections** (prereqs + what it supports)

---

## 1. Maximum likelihood, cross‑entropy, KL (the core training objective)

**Canonical papers**

* Neural language modeling with neural nets: Bengio et al., *A Neural Probabilistic Language Model* (2003). ([Semantic Scholar][1])
* General deep‑learning treatments use the same math (not one specific paper).

**Core math**

Almost every frontier model is trained by (approximate) **maximum likelihood**:

[
\max_\theta \sum_{i=1}^n \log p_\theta(x^{(i)})
]

Equivalently, minimize empirical **cross‑entropy** between data distribution (\hat p) and model (p_\theta):

[
\min_\theta H(\hat p, p_\theta)
= \min_\theta \left[ -\mathbb E_{x\sim \hat p} \log p_\theta(x) \right]
]

This is the same as minimizing **KL divergence**:

[
\mathrm{KL}(\hat p ,|, p_\theta)
= \mathbb E_{\hat p} \log \frac{\hat p(x)}{p_\theta(x)}
]

(up to the constant (H(\hat p))).

For **autoregressive LMs**, factorization comes from the chain rule:

[
p_\theta(x_1,\dots,x_T) = \prod_{t=1}^T p_\theta(x_t \mid x_{<t})
]

and you minimize next‑token cross‑entropy.

**Why it’s still relevant / who uses it**

* Pretraining for GPT‑4, Claude, Gemini, Llama: next‑token cross‑entropy over web/text/code. ([arXiv][2])
* Stable Diffusion & Sora also optimize likelihood‑style surrogates (e.g. noise‑prediction MSE that is a re‑parameterized ELBO / likelihood objective). ([arXiv][3])
* Reward models in RLHF are themselves trained via cross‑entropy / logistic losses on human preference data. ([arXiv][4])

**Missing intuition**

Most explanations don’t really emphasize:

* **Why KL direction matters** ((\mathrm{KL}(p_\text{data} |\ p_\theta)) vs the reverse) and how it biases models toward covering modes vs being conservative.
* How cross‑entropy **shapes behavior under distribution shift** (e.g., hallucinations: the model still picks a “likely token” under its learned (p_\theta), even when the input is off‑manifold).

**Connections**

* **Prereqs:** probability, information theory (entropy, KL).
* **Feeds into:** VAEs, diffusion, flows (all rephrase likelihood); RLHF objectives are often “reward – β·KL to reference,” directly reusing these divergences.

---

## 2. Scaled dot‑product attention & transformer layers

**Canonical papers**

* Vaswani et al., *Attention Is All You Need* (2017). ([arXiv][5])
* GPT‑4 / Gemini technical reports describe large‑scale decoder‑only or mixture encoder‑decoder variants of this architecture. ([arXiv][6])

**Core math**

Single attention head:

[
\text{Attn}(Q,K,V) = \mathrm{softmax}!\left(\frac{QK^\top}{\sqrt{d_k}}\right)V
]

where (Q = XW_Q,\ K = XW_K,\ V = XW_V). Multi‑head attention concatenates several such heads.

A standard transformer block:

[
\begin{aligned}
H' &= \mathrm{MHA}(\mathrm{LN}(H)) + H \
H^{\text{out}} &= \mathrm{MLP}(\mathrm{LN}(H')) + H'
\end{aligned}
]

**Why it’s still relevant / who uses it**

* GPT‑4, Claude, Gemini, Llama: giant stacks of decoder‑only transformer blocks with causal self‑attention. ([arXiv][2])
* Stable Diffusion: U‑Net with self‑ and cross‑attention between image latents and text embeddings. ([Computer Vision & Learning Group][7])
* Sora: a **diffusion transformer** operating on spacetime patches (video tokens). ([OpenAI][8])

**Missing intuition**

* Geometric picture of **Q–K dot products** as measuring angles between feature directions, and how softmax turns those into a *distribution of “who to copy from”* along the sequence.
* How multi‑head attention effectively builds a set of **learned kernels** over positions/features, and why this is strictly more flexible than fixed kernels.

**Connections**

* **Prereqs:** linear algebra (dot products), softmax as log‑partition function.
* **Dependents:** induction‑head circuits (mechanistic interpretability), sparse MoE transformers, long‑context architectures, scaling‑law behavior of LMs.

---

## 3. Adam & adaptive gradient methods

**Canonical papers**

* Kingma & Ba, *Adam: A Method for Stochastic Optimization* (2014). ([arXiv][9])
* Reddi et al., *On the Convergence of Adam and Beyond* (ICLR 2018). ([arXiv][10])

**Core math**

For gradient (g_t = \nabla_\theta L_t(\theta_t)):

[
\begin{aligned}
m_t &= \beta_1 m_{t-1} + (1-\beta_1) g_t \
v_t &= \beta_2 v_{t-1} + (1-\beta_2) g_t^2 \
\hat m_t &= m_t / (1-\beta_1^t),\quad
\hat v_t = v_t / (1-\beta_2^t) \
\theta_{t+1} &= \theta_t - \alpha \frac{\hat m_t}{\sqrt{\hat v_t} + \varepsilon}
\end{aligned}
]

Convergence analyses show that naïve Adam can diverge on simple convex problems and motivate variants like AMSGrad. ([arXiv][10])

**Why it’s still relevant / who uses it**

* Large foundation models almost universally use Adam or AdamW (Adam + decoupled weight decay) for pretraining and fine‑tuning.
* RLHF and diffusion training also use Adam‑style optimizers to handle noisy gradients and widely varying scales.

**Missing intuition**

* Clear, *geometric* explanation of how per‑coordinate scaling with (1/\sqrt{v_t}) interacts with overparameterized nets—why it sometimes **hurts** generalization versus SGD, and why combining Adam with weight decay behaves very differently from classical (L_2) regularization.
* How Adam’s bias‑correction and exponential averaging interact with **curriculum** and non‑stationary objectives (e.g. RLHF).

**Connections**

* **Prereqs:** convex optimization, stochastic approximation.
* **Dependents:** loss‑landscape geometry (sharp vs flat minima), scaling‑law exponents (training efficiency), RLHF stability, training dynamics in NTK regime.

---

## 4. Loss landscapes, sharpness & flat minima (SAM, “no bad local minima”)

**Canonical papers**

* Kawaguchi, *Deep Learning without Poor Local Minima* (NeurIPS 2016). ([People at MIT CSAIL][11])
* Foret et al., *Sharpness‑Aware Minimization for Efficiently Improving Generalization* (SAM, 2020). ([arXiv][12])

**Core math**

SAM objective:

[
\min_w \max_{|\epsilon|_p \le \rho} L(w + \epsilon)
]

In practice:

1. Take a *single* gradient step to find “worst‑case” perturbation
   (\epsilon(w) \approx \rho \frac{\nabla L(w)}{|\nabla L(w)|_2}). ([Wikipedia][13])
2. Update using gradient at the perturbed weights: (\nabla L(w+\epsilon(w))).

Theoretical results like Kawaguchi’s show certain deep linear/ReLU networks’ loss surfaces have no “bad” local minima (all local minima are global or near‑global), explaining why SGD can work in such non‑convex spaces. ([ScienceDirect][14])

**Why it’s still relevant / who uses it**

* Frontier models aren’t explicitly trained with SAM, but **implicit flat‑minima bias** (mini‑batch SGD, data augmentation, weight decay) appears crucial to their generalization.
* Fine‑tuning and RLHF pipelines sometimes adopt SAM‑like ideas to stabilize training and reduce overfitting on small preference datasets.

**Missing intuition**

* Most expositions show “sharp vs flat” pictures in 2D, but we lack intuitive stories for **high‑dimensional anisotropic sharpness** and its relation to robustness / OOD generalization.
* How mode connectivity (many minima connected by low‑loss paths) interacts with flatness and weight averaging is still conceptually fuzzy.

**Connections**

* **Prereqs:** basic optimization & Hessian/eigenvalues.
* **Dependents:** double‑descent generalization, ensembling / model soups, low‑precision robustness (quantization works better near flat minima).

---

## 5. Overparameterization & generalization, double descent

**Canonical papers**

* Zhang et al., *Understanding Deep Learning Requires Rethinking Generalization* (ICLR 2017). ([arXiv][15])
* Belkin et al., *Reconciling Modern Machine‑Learning Practice and the Bias–Variance Trade‑off* (double descent, 2019). ([arXiv][16])

**Core math**

Classical learning theory: test error ~ U‑shaped function of model capacity. Empirically, modern nets show **double descent**: as parameters cross the interpolation threshold (0 training error), test error **drops again** as capacity keeps growing. ([arXiv][16])

Theoretically, in simple linear models, test error can be expressed as:

[
\mathbb E[(y - \hat y)^2]
= \text{bias}^2 + \text{variance} + \sigma^2
]

and variance explodes near interpolation, then decreases as overparameterization plus implicit regularization (e.g. minimum‑norm solutions) kicks in.

**Why it’s still relevant / who uses it**

* GPT‑4‑class models are deep in the **overparameterized regime**: parameter count ≫ number of training examples. Yet they generalize extremely well because SGD prefers special minima (e.g., minimum‑norm in function space). ([arXiv][15])
* Chinchilla‑style scaling laws explicitly model how test loss scales with both capacity and data, sitting on top of this phenomenon. ([arXiv][17])

**Missing intuition**

* Good, *visual* intuition for why larger nets + the same training objective can generalize **better** (not just “they memorize more”).
* How implicit biases of different optimizers (SGD vs Adam) select among infinite interpolating solutions.

**Connections**

* **Prereqs:** basic PAC/VC generalization, linear regression.
* **Dependents:** scaling laws (choosing optimal model size vs data), compression views (flat minima ↔ compressible models), NTK (infinite‑width interpolation).

---

## 6. Neural Tangent Kernel (NTK) & infinite‑width limits

**Canonical papers**

* Jacot et al., *Neural Tangent Kernel: Convergence and Generalization in Neural Networks* (NeurIPS 2018). ([arXiv][18])

**Core math**

Define network (f_\theta(x)) with parameters (\theta). The **NTK** is:

[
\Theta(x,x') = \nabla_\theta f_\theta(x)^\top \nabla_\theta f_\theta(x')
]

In the infinite‑width limit (under appropriate scaling), this kernel becomes deterministic and remains constant during training. Training with gradient descent becomes:

[
\partial_t f_t(x) = - \sum_{i} \Theta(x,x_i), \frac{\partial \ell(f_t(x_i), y_i)}{\partial f}
]

a linear ODE in function space, just like kernel regression. ([arXiv][18])

**Why it’s still relevant / who uses it**

* NTK provides a mathematically clean limit where we *can* predict learning dynamics and generalization, serving as a baseline for understanding real‑world finite‑width LMs.
* Many mechanistic‑interpretability and scaling‑law arguments implicitly assume behavior “somewhere between” kernel‑like and feature‑learning regimes.

**Missing intuition**

* Most expositions are algebraic; what’s missing is a **geometric animation** showing how trajectories in function space under NTK differ from those under genuine feature learning (NTK frozen vs evolving).

**Connections**

* **Prereqs:** kernel methods, random feature expansions. ([NeurIPS Proceedings][19])
* **Dependents:** theoretical explanations of early stopping, dynamics of wide transformers, why some layers behave more “linear / kernel‑like” than others.

---

## 7. Variational Autoencoders (VAEs) & variational inference

**Canonical papers**

* Kingma & Welling, *Auto‑Encoding Variational Bayes* (2013). ([arXiv][20])

**Core math**

Latent variable model (p_\theta(x,z) = p(z)p_\theta(x\mid z)) with intractable posterior. Introduce variational encoder (q_\phi(z\mid x)) and maximize **ELBO**:

[
\log p_\theta(x) \ge
\mathbb E_{q_\phi(z\mid x)}[\log p_\theta(x\mid z)]

* \mathrm{KL}(q_\phi(z\mid x),|,p(z))
  ]

Reparameterization trick for Gaussian encoder:

[
z = \mu_\phi(x) + \sigma_\phi(x)\odot\epsilon,\quad \epsilon\sim\mathcal N(0,I)
]

**Why it’s still relevant / who uses it**

* Stable Diffusion is a **latent diffusion model**: an autoencoder (VAE‑like) maps images ↔ compressed latent space where diffusion operates. ([Computer Vision & Learning Group][7])
* VAEs underpin many multimodal encoders (e.g. audio or video latents) used as building blocks in larger systems.

**Missing intuition**

* Intuitive grasp of **why ELBO works** as both reconstruction + regularization, and how the KL term shapes latent geometry (collapsed vs disentangled spaces).
* Visualizations of how the prior (p(z)) and posterior families affect sample quality / diversity.

**Connections**

* **Prereqs:** Bayes rule, KL, stochastic computation graphs.
* **Dependents:** latent diffusion (Stable Diffusion, SDXL), flow‑based models (ELBO‑like objectives), information‑bottleneck views.

---

## 8. GANs & adversarial divergence minimization

**Canonical papers**

* Goodfellow et al., *Generative Adversarial Nets* (NeurIPS 2014). ([NeurIPS Proceedings][21])
* Arjovsky et al., *Wasserstein GAN* (2017) for more stable variants. ([Transformer Circuits][22])

**Core math**

Original GAN objective:

[
\min_G \max_D
; \mathbb E_{x\sim p_\text{data}}[\log D(x)]

* \mathbb E_{z\sim p(z)}[\log(1 - D(G(z)))]
  ]

At optimum, with optimal discriminator (D^*), this minimizes the **Jensen–Shannon divergence** between model and data. ([NeurIPS Proceedings][21])

WGAN replaces JS with Earth‑Mover (Wasserstein‑1) distance, with Lipschitz constraints on (D).

**Why it’s still relevant / who uses it**

* Pure GANs are less common in frontier text models today, but adversarial min–max ideas appear in **adversarial training** and some alignment techniques.
* GAN‑like training is still influential in high‑fidelity image/video generation and image refinement stages, sometimes combined with diffusion.

**Missing intuition**

* Clear explanation of **why** JS divergence leads to vanishing gradients when supports don’t overlap, and how Wasserstein distances fix this.
* Better geometric visualizations of discriminator decision surfaces over latent manifolds.

**Connections**

* **Prereqs:** f‑divergences, IPM metrics (Wasserstein).
* **Dependents:** adversarial robustness, some reinforcement‑learning formulations with discriminator‑style critics.

---

## 9. Diffusion, score‑based models & flow matching

**Canonical papers**

* Sohl‑Dickstein et al., *Deep Unsupervised Learning using Nonequilibrium Thermodynamics* (ICML 2015). ([arXiv][23])
* Ho et al., *Denoising Diffusion Probabilistic Models* (NeurIPS 2020). ([arXiv][3])
* Song et al., *Score‑Based Generative Modeling through SDEs* (2021). ([arXiv][24])
* Lipman et al., *Flow Matching for Generative Modeling* (ICLR 2023). ([arXiv][25])
* Liu et al., *Rectified Flow* (2022). ([arXiv][26])

**Core math**

Forward **diffusion** process adds noise:

Discrete DDPM:
[
q(x_t \mid x_{t-1}) = \mathcal N(\sqrt{1-\beta_t},x_{t-1}, \beta_t I)
]

Closed‑form:
[
q(x_t \mid x_0) = \mathcal N(\sqrt{\bar\alpha_t},x_0, (1-\bar\alpha_t)I)
]

Model learns to predict noise (\epsilon) via MSE:

[
\mathcal L = \mathbb E_{x_0,t,\epsilon} \big|\epsilon - \epsilon_\theta(x_t,t)\big|^2
]

This is equivalent to maximizing a variational bound on log‑likelihood. ([arXiv][3])

**Score‑based SDE** view: forward SDE (dx_t = f(x_t,t),dt + g(t),dW_t). Reverse‑time SDE uses **score** (\nabla_x \log p_t(x)). ([arXiv][24])

**Flow matching / rectified flow**: define probability path between noise & data and train vector field (v_\theta(x,t)) to match the “true” conditional field (often direction of optimal transport / straight lines). This recovers continuous normalizing flows and subsumes diffusion. ([arXiv][25])

**Why it’s still relevant / who uses it**

* Stable Diffusion: **latent diffusion** — DDPM in a VAE latent space; foundation of SD 1.x/2.x and SDXL. ([Computer Vision & Learning Group][7])
* Sora: **diffusion transformer** over 3D spacetime patches; uses diffusion/score objectives combined with transformer architecture. ([OpenAI][8])
* Many recent text, audio, and image models are either DDPMs, score models, flows, or hybrids; flow‑matching and rectified flows are key to **one‑step** or few‑step generation at SD‑like quality. ([arXiv][25])

**Missing intuition**

* Intuitive explanation that denoising is really learning **(\nabla_x \log p_t(x))** (scores), and how reverse‑time SDE sampling corresponds to “walking uphill in log‑density space.”
* Visual/interactive demonstrations of different probability paths (diffusion vs optimal transport) and how they affect sample quality & speed.

**Connections**

* **Prereqs:** stochastic calculus lite, ELBO/loss from §1 and §7.
* **Dependents:** video generators (Sora), audio diffusion, speed‑up via distillation / consistency models, flow‑matching‑based one‑shot generators.

---

## 10. Representation learning & embedding geometry

**Canonical papers**

* Bengio et al., *Representation Learning: A Review and New Perspectives* (IEEE 2013). ([arXiv][27])

(Plus many self‑supervised / contrastive works like SimCLR / CLIP, but Bengio’s survey is a good conceptual anchor.)

**Core math**

Idea: learn a mapping (f_\theta: \mathcal X \to \mathbb R^d) such that inner products or distances reflect meaningful relations.

Example: **contrastive objective** (InfoNCE‑style):

[
\mathcal L = - \mathbb E \left[
\log \frac{\exp(\mathrm{sim}(f(x),g(y))/\tau)}
{\sum_{y'} \exp(\mathrm{sim}(f(x), g(y'))/\tau)}
\right]
]

This pushes “positive” pairs together, “negatives” apart; at optimum, it maximizes a lower bound on mutual information between views. ([arXiv][27])

**Why it’s still relevant / who uses it**

* Word & token embeddings in LMs, vision embeddings in CLIP‑like models, multimodal embeddings in Gemini and GPT‑4V, all rely on **geometric structure in representation space**. ([Google Cloud Storage][28])
* Latent spaces of Stable Diffusion / SDXL are designed so distances roughly correspond to semantic similarity and are easy for the denoiser to operate in. ([Computer Vision & Learning Group][7])

**Missing intuition**

* Clear geometric explanation of **anisotropy** (representations bunch along a few directions) and how normalization / whitening alter model behavior.
* Visuals showing how representations evolve across layers (e.g., from local to global features).

**Connections**

* **Prereqs:** linear algebra, cosine similarity, mutual information.
* **Dependents:** mechanistic interpretability (features as directions), superposition, probing, retrieval‑augmented models (similarity search in embedding spaces).

---

## 11. Superposition, sparse features & monosemanticity

**Canonical papers**

* Elhage et al., *Toy Models of Superposition* (Anthropic, 2022). ([arXiv][29])
* Bricken et al. / Anthropic, *Towards Monosemanticity: Decomposing Language Models with Dictionary Learning* (2023). ([Transformer Circuits][30])

**Core math**

Superposition: features are represented not by one neuron each, but as **sparse directions** in activation space. Formalized via **dictionary learning**:

[
\min_{A, s_i} \sum_i |h_i - A s_i|_2^2 + \lambda |s_i|_1
]

where (h_i) are activations, columns of (A) are *features*, and (s_i) are sparse codes. ([Transformer Circuits][30])

Anthropic show that sparse autoencoders applied to transformer MLP activations recover relatively interpretable, “monosemantic” features. ([Transformer Circuits][30])

**Why it’s still relevant / who uses it**

* Frontier LMs heavily rely on superposition: neurons and attention heads implement many overlapping features, explaining emergent behavior and brittle interpretability.
* Monosemantic dictionaries learned with sparse autoencoders are now being applied to Claude‑class models and others for interpretability & safety analysis. ([Transformer Circuits][31])

**Missing intuition**

* A *simple* geometric story for why superposition is *useful* (capacity vs interference trade‑offs) and how it emerges from training objectives.
* Interactive views of how sparse autoencoders carve up activation space into overlapping feature directions and how those respond to prompts.

**Connections**

* **Prereqs:** representation geometry, sparse coding, L1 regularization.
* **Dependents:** mechanistic interpretability, interpretability‑driven training objectives, feature‑space editing / steering.

---

## 12. Probing, linear classifier probes & activation analysis

**Canonical papers**

* Alain & Bengio, *Understanding Intermediate Layers using Linear Classifier Probes* (2016). ([arXiv][32])
* Tenney et al., *BERT Rediscovers the Classical NLP Pipeline* (ACL 2019). ([ACL Anthology][33])
* Belinkov, *Probing Classifiers: Promises, Shortcomings, and Advances* (2022). ([arXiv][34])

**Core math**

Given layer representation (h_\ell(x)), we train a frozen **probe**:

[
\hat y = W h_\ell(x) + b
]

(or a softmax over (Wh_\ell(x))) on a supervised task (POS tags, parse trees, etc.). The accuracy of this linear classifier estimates how linearly separable that information is at layer (\ell). ([arXiv][32])

Tenney et al. showed that BERT layers roughly follow the classical NLP pipeline (POS → syntax → semantics → coreference). ([ACL Anthology][33])

**Why it’s still relevant / who uses it**

* Probing is one of the main tools to understand what GPT‑like models know and *where* that knowledge lives.
* Used heavily for safety (e.g., probing for dangerous capabilities), robustness, and fairness analyses in LMs.

**Missing intuition**

* Clear mental model of **what probes measure** (information content vs ease of extraction) and when probe performance reflects true internal structure vs “shortcut features.”
* Visual, layer‑by‑layer maps of information flow in large LMs.

**Connections**

* **Prereqs:** basic linear models, supervised evaluation.
* **Dependents:** mechanistic interpretability pipelines, safety evaluations, representation‑editing methods.

---

## 13. Transformer circuits, induction heads & mechanistic interpretability

**Canonical papers**

* Elhage et al., *A Mathematical Framework for Transformer Circuits* (2021). ([arXiv][35])
* Olsson et al., *In‑Context Learning and Induction Heads* (2022). ([Transformer Circuits][36])
* Olah et al., *Feature Visualization* (Distill, 2017). ([Distill][37])

**Core math**

Elhage et al. decompose transformer computations into linear components on the residual stream:

[
r_{l+1} = r_l + W^\text{attn}_l r_l + W^\text{mlp}_l r_l
]

so each attention/MLP block is interpreted as a mostly linear map plus a simple nonlinearity, enabling circuit‑level analysis. ([arXiv][35])

**Induction heads**: specific attention heads implement an algorithm:

[
[A][B]\dots[A] \rightarrow [B]
]

by attending from the final [A] token to previous [A] tokens and copying the subsequent token’s representation. Olsson et al. tie the sudden appearance of these heads to a phase transition in in‑context learning. ([arXiv][38])

**Why it’s still relevant / who uses it**

* These frameworks are used directly to study GPT‑style models, including Llama‑3 and Claude‑3 Sonnet, by identifying concrete circuits for tasks like copying, induction, or specific linguistic patterns. ([Transformer Circuits][31])
* They inform safety research (e.g., locating deception‑related circuits) and architecture design.

**Missing intuition**

* Good **interactive visualizations** of how QK and OV matrices implement algorithms like induction and translation in high dimensions.
* Broader taxonomies of circuit motifs beyond a few toy examples.

**Connections**

* **Prereqs:** §2 transformers, §10 representations.
* **Dependents:** superposition & dictionary learning (§11), feature visualization, interpretability‑constrained training.

---

## 14. Scaling laws & emergent abilities

**Canonical papers**

* Kaplan et al., *Scaling Laws for Neural Language Models* (2020). ([NeurIPS Proceedings][39])
* Hoffmann et al., *Training Compute‑Optimal Large Language Models* (Chinchilla, 2022). ([arXiv][40])
* Wei et al., *Emergent Abilities of Large Language Models* (2022). ([arXiv][41])

**Core math**

Kaplan et al.: test loss (L) obeys approximate power laws:

[
L(N, D, C) \approx L_\infty + a N^{-\alpha} + b D^{-\beta}
]

where (N) = parameters, (D) = data, (C) = compute; (\alpha,\beta) are exponents. ([NeurIPS Proceedings][39])

Hoffmann et al.: for fixed compute, optimal frontier scales roughly as:

[
D \propto N
]

i.e., don’t over‑scale parameters without matching data (Chinchilla rule). ([arXiv][40])

Wei et al.: some capabilities (e.g. chain‑of‑thought, few‑shot reasoning) appear **suddenly** once scale crosses a threshold—“emergent abilities.” ([arXiv][41])

**Why it’s still relevant / who uses it**

* GPT‑3.5/4, Claude, Gemini, Llama‑2/3 were all designed with these scaling behaviors in mind (data vs model vs compute trade‑offs). ([arXiv][2])
* Sora & SDXL apply similar scaling‑law reasoning for image/video diffusion backbones. ([arXiv][42])

**Missing intuition**

* Why power‑law scaling *happens* (e.g., statistical physics analogies, information‑theoretic arguments) and what actually underlies “emergent” phase transitions.
* Visual, interactive plots that show evolving task‑specific performance vs scale and highlight where qualitative behavior changes.

**Connections**

* **Prereqs:** §5 generalization, basic statistics.
* **Dependents:** capability forecasting, system design (how big to make the next model), safety risk forecasting.

---

## 15. Preference‑based alignment: RLHF, reward modeling, Constitutional AI

**Canonical papers**

* Christiano et al., *Deep Reinforcement Learning from Human Preferences* (2017). ([arXiv][43])
* Ziegler et al., *Fine‑Tuning Language Models from Human Preferences* (2019). ([arXiv][4])
* Stiennon et al., *Learning to Summarize with Human Feedback* (NeurIPS 2020). ([NeurIPS Proceedings][44])
* Ouyang et al., *Training Language Models to Follow Instructions with Human Feedback* (InstructGPT, 2022). ([arXiv][35])
* Bai et al., *Constitutional AI: Harmlessness from AI Feedback* (2022). ([arXiv][29])

**Core math**

1. **Reward modeling from preferences**
   Given human comparisons between outputs (y_a, y_b) for the same prompt (x), learn reward model (r_\phi(x,y)) by fitting a Bradley–Terry / logistic model:

[
P(y_a \succ y_b \mid x) =
\frac{\exp(r_\phi(x,y_a))}
{\exp(r_\phi(x,y_a)) + \exp(r_\phi(x,y_b))}
]

Train (\phi) via cross‑entropy. ([arXiv][4])

2. **RLHF objective**
   Fine‑tune policy (\pi_\theta(y\mid x)) to maximize reward while staying close to reference model (\pi_0):

[
\max_\theta \mathbb E_{x,y\sim \pi_\theta}
\big[r_\phi(x,y)\big] - \beta, \mathrm{KL}\big(\pi_\theta(\cdot\mid x),|,\pi_0(\cdot\mid x)\big)
]

Typically solved with PPO‑style policy gradient. ([arXiv][35])

3. **Constitutional AI / RLAIF**
   Same idea, but the “labeler” is another model guided by a **constitution** (set of natural‑language principles), yielding AI feedback instead of or in addition to human labels. ([arXiv][29])

**Why it’s still relevant / who uses it**

* GPT‑4, Claude‑3, Gemini, and many open‑source instruction‑tuned LMs rely on RLHF‑style procedures to be helpful, honest, harmless. ([arXiv][6])
* Constitutional AI ideas are key to Anthropic’s Claude models and influence self‑alignment pipelines elsewhere. ([arXiv][29])

**Missing intuition**

* Conceptual explanation of the RLHF objective as a **KL‑regularized Bayesian update** on behavior, and how over‑optimization of the learned reward leads to **reward hacking** and distribution shift.
* Interactive visualizations of policy distributions before/after RLHF in token space.

**Connections**

* **Prereqs:** RL, policy gradient, §1 divergences.
* **Dependents:** safety guarantees, scalable oversight schemes, debate / oversight protocols.

---

## 16. Efficiency: quantization, distillation, LoRA & sparse MoE

**Canonical papers**

* Hinton et al., *Distilling the Knowledge in a Neural Network* (2015). ([arXiv][45])
* Jacob et al., *Quantization and Training of Neural Networks for Efficient Integer‑Arithmetic‑Only Inference* (2018). ([arXiv][46])
* Hu et al., *LoRA: Low‑Rank Adaptation of Large Language Models* (2021). ([arXiv][47])
* Fedus et al., *Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity* (2021). ([Emerging Technologies][48])

**Core math**

1. **Distillation**: train a student (q_\psi(y\mid x)) to match teacher (p_\theta):

[
\mathcal L = T^2,\mathrm{KL}(p_\theta^T(\cdot\mid x),|,q_\psi^T(\cdot\mid x))
]

with softened distributions at temperature (T). ([arXiv][45])

2. **Quantization**: map float weights to low‑bit integers:

[
\tilde w = \Delta \cdot \mathrm{round}(w/\Delta)
]

Hardware runs integer ops; training often learns (\Delta) and compensates for quantization error. ([arXiv][46])

3. **LoRA**: re‑parameterize weight matrix as:

[
W' = W + BA,\quad B\in\mathbb R^{d\times r},,A\in\mathbb R^{r\times d},\ r\ll d
]

and only train (A,B), freezing (W). ([arXiv][47])

4. **Sparse MoE (Switch)**: FFN layers replaced by many experts (f_e), with router choosing one:

[
\text{FFN}*\text{MoE}(x) = f*{e^*(x)}(x),\quad e^*(x) = \arg\max_e g_e(x)
]

Only a small subset of parameters is active per token. ([Emerging Technologies][48])

**Why it’s still relevant / who uses it**

* Quantization + LoRA are standard for deploying and fine‑tuning Llama‑class models on modest GPUs. ([arXiv][47])
* Distillation is used to compress large base models into “small assistants” and to distill diffusion models into one‑ or few‑step generators. ([arXiv][45])
* MoE / Switch‑style sparsity powers very large Google‑scale models (and likely some components of Gemini). ([Emerging Technologies][48])

**Missing intuition**

* Better geometric views of **low‑rank updates**: LoRA as adding a small, oriented “slice” in weight space and why this suffices to learn new tasks.
* Intuitive trade‑offs in quantization: how error propagates, why some layers are more sensitive than others.

**Connections**

* **Prereqs:** matrix factorization, quantization/rounding, KL.
* **Dependents:** practical deployment, on‑device models, efficient RLHF, fast diffusion / rectified flow.

---

## 17. Theoretical foundations: PAC learning, MDL & information bottleneck

**Canonical papers**

* Valiant, *A Theory of the Learnable* (1984) — PAC learning framework. ([ACM Digital Library][49])
* Rissanen, *Modeling by Shortest Data Description* (1978) — MDL. ([Association for Psychological Science][50])
* Tishby et al., *Deep Learning and the Information Bottleneck Principle* (2015). ([arXiv][51])

**Core math**

1. **PAC learning** (informal): concept class (\mathcal C) is PAC‑learnable if there exists an algorithm that, for all distributions and all (\epsilon,\delta > 0), uses

[
n = O\left(\frac{1}{\epsilon}\big(d \log \tfrac{1}{\epsilon} + \log\tfrac{1}{\delta}\big)\right)
]

examples to output a hypothesis with error ≤ (\epsilon) with probability ≥ (1-\delta), where (d) is VC dimension. ([ACM Digital Library][49])

2. **MDL**: choose hypothesis (H) minimizing total description length:

[
L(D,H) = L(H) + L(D\mid H)
]

Model complexity ↔ code length for hypothesis; goodness‑of‑fit ↔ code length for data given model. ([Wikipedia][52])

3. **Information Bottleneck**: learn representation (Z) of input (X) that keeps information about target (Y) but compresses (X):

[
\max_{p(z\mid x)} I(Z;Y) - \beta I(Z;X)
]

Interprets representation learning as trading off prediction vs compression. ([arXiv][51])

**Why it’s still relevant / who uses it**

* PAC/VC theory doesn’t directly explain deep LMs but gives **language and bounds** for generalization and sample complexity.
* MDL/compression perspectives underlie the idea that good models should be both **simple and predictive**, connecting to flat minima, pruning, and scaling laws. ([Wikipedia][52])
* Info‑bottleneck ideas motivate **representation compression** and regularization techniques and are conceptually helpful when thinking about what middle layers in GPT‑like models are doing.

**Missing intuition**

* How to connect formal sample‑complexity bounds to **actual** overparameterized models that interpolate training data.
* Intuitive, visual examples of MDL in deep nets (e.g., comparing code lengths of different architectures trained on the same dataset).

**Connections**

* **Prereqs:** information theory, basic learning theory.
* **Dependents:** arguments about why scaling & compression relate to generalization, principled model selection and pruning, conceptual understanding of representation depth.

---

### How to *use* this map

If you want to deeply understand frontier models, a good study order is roughly:

1. **Core probabilistic training + transformers**: concepts 1–2
2. **Optimization & generalization**: 3–6
3. **Generative modeling families**: 7–9
4. **Representation & interpretability**: 10–13
5. **Scaling & alignment**: 14–15
6. **Efficiency & theory**: 16–17

For many of these, a **visual / interactive treatment** (e.g., sliders over noise level in diffusion, live diagrams of attention weights, animations of NTK vs feature‑learning dynamics) would add a lot of intuition that’s missing from both blog posts and papers.

If you’d like, I can next:

* Design a reading curriculum around these 16 concepts; or
* Pick a single concept (e.g., diffusion, induction heads, or RLHF) and give a more visual, intuition‑heavy deep dive.

[1]: https://www.semanticscholar.org/paper/A-Neural-Probabilistic-Language-Model-Bengio-Ducharme/6c2b28f9354f667cd5bd07afc0471d8334430da7?utm_source=chatgpt.com "[PDF] A Neural Probabilistic Language Model"
[2]: https://arxiv.org/abs/2303.08774?utm_source=chatgpt.com "[2303.08774] GPT-4 Technical Report"
[3]: https://arxiv.org/abs/2006.11239?utm_source=chatgpt.com "Denoising Diffusion Probabilistic Models"
[4]: https://arxiv.org/abs/1909.08593?utm_source=chatgpt.com "Fine-Tuning Language Models from Human Preferences"
[5]: https://arxiv.org/abs/1706.03762?utm_source=chatgpt.com "[1706.03762] Attention Is All You Need"
[6]: https://arxiv.org/html/2303.08774v6?utm_source=chatgpt.com "GPT-4 Technical Report"
[7]: https://ommer-lab.com/research/latent-diffusion-models/?utm_source=chatgpt.com "High-Resolution Image Synthesis with Latent Diffusion Models"
[8]: https://openai.com/index/video-generation-models-as-world-simulators/?utm_source=chatgpt.com "Video generation models as world simulators"
[9]: https://arxiv.org/abs/1412.6980?utm_source=chatgpt.com "[1412.6980] Adam: A Method for Stochastic Optimization"
[10]: https://arxiv.org/abs/1904.09237?utm_source=chatgpt.com "[1904.09237] On the Convergence of Adam and Beyond"
[11]: https://people.csail.mit.edu/kawaguch/publications/kawaguchi-nips16.pdf?utm_source=chatgpt.com "Deep Learning without Poor Local Minima - People | MIT CSAIL"
[12]: https://arxiv.org/abs/2010.01412?utm_source=chatgpt.com "Sharpness-Aware Minimization for Efficiently Improving Generalization"
[13]: https://en.wikipedia.org/wiki/Sharpness_aware_minimization?utm_source=chatgpt.com "Sharpness aware minimization"
[14]: https://www.sciencedirect.com/science/article/pii/S0893608019301820?utm_source=chatgpt.com "Depth with nonlinearity creates no bad local minima in ..."
[15]: https://arxiv.org/abs/1611.03530?utm_source=chatgpt.com "Understanding deep learning requires rethinking generalization"
[16]: https://arxiv.org/abs/1812.11118?utm_source=chatgpt.com "Reconciling modern machine learning practice and the bias-variance trade-off"
[17]: https://arxiv.org/pdf/2001.08361?utm_source=chatgpt.com "Scaling Laws for Neural Language Models"
[18]: https://arxiv.org/abs/1806.07572?utm_source=chatgpt.com "Neural Tangent Kernel: Convergence and Generalization in Neural Networks"
[19]: https://papers.nips.cc/paper/3182-random-features-for-large-scale-kernel-machines?utm_source=chatgpt.com "Random Features for Large-Scale Kernel Machines"
[20]: https://arxiv.org/abs/1312.6114?utm_source=chatgpt.com "Auto-Encoding Variational Bayes"
[21]: https://papers.nips.cc/paper/5423-generative-adversarial-nets?utm_source=chatgpt.com "Generative Adversarial Nets"
[22]: https://transformer-circuits.pub/2021/framework/index.html?utm_source=chatgpt.com "A Mathematical Framework for Transformer Circuits"
[23]: https://arxiv.org/abs/1503.03585?utm_source=chatgpt.com "Deep Unsupervised Learning using Nonequilibrium Thermodynamics"
[24]: https://arxiv.org/abs/2011.13456?utm_source=chatgpt.com "Score-Based Generative Modeling through Stochastic Differential Equations"
[25]: https://arxiv.org/abs/2210.02747?utm_source=chatgpt.com "Flow Matching for Generative Modeling"
[26]: https://arxiv.org/abs/2209.03003?utm_source=chatgpt.com "Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow"
[27]: https://arxiv.org/abs/1206.5538?utm_source=chatgpt.com "Representation Learning: A Review and New Perspectives"
[28]: https://storage.googleapis.com/deepmind-media/gemini/gemini_1_report.pdf?utm_source=chatgpt.com "Gemini: A Family of Highly Capable Multimodal Models"
[29]: https://arxiv.org/abs/2212.08073?utm_source=chatgpt.com "Constitutional AI: Harmlessness from AI Feedback"
[30]: https://transformer-circuits.pub/2023/monosemantic-features?utm_source=chatgpt.com "Decomposing Language Models With Dictionary Learning"
[31]: https://transformer-circuits.pub/2024/scaling-monosemanticity/?utm_source=chatgpt.com "Extracting Interpretable Features from Claude 3 Sonnet"
[32]: https://arxiv.org/abs/1610.01644?utm_source=chatgpt.com "Understanding intermediate layers using linear classifier probes"
[33]: https://aclanthology.org/P19-1452/?utm_source=chatgpt.com "BERT Rediscovers the Classical NLP Pipeline"
[34]: https://arxiv.org/abs/2102.12452?utm_source=chatgpt.com "Probing Classifiers: Promises, Shortcomings, and Advances"
[35]: https://arxiv.org/abs/2203.02155?utm_source=chatgpt.com "Training language models to follow instructions with human feedback"
[36]: https://transformer-circuits.pub/2022/in-context-learning-and-induction-heads/index.html?utm_source=chatgpt.com "In-context Learning and Induction Heads"
[37]: https://distill.pub/2017/feature-visualization?utm_source=chatgpt.com "Feature Visualization"
[38]: https://arxiv.org/abs/2209.11895?utm_source=chatgpt.com "In-context Learning and Induction Heads"
[39]: https://proceedings.neurips.cc/paper/2020/hash/4c5bcfec8584af0d967f1ab10179ca4b-Abstract.html?utm_source=chatgpt.com "Denoising Diffusion Probabilistic Models"
[40]: https://arxiv.org/abs/2203.15556?utm_source=chatgpt.com "Training Compute-Optimal Large Language Models"
[41]: https://arxiv.org/abs/2206.07682?utm_source=chatgpt.com "Emergent Abilities of Large Language Models"
[42]: https://arxiv.org/abs/2307.01952?utm_source=chatgpt.com "SDXL: Improving Latent Diffusion Models for High-Resolution Image Synthesis"
[43]: https://arxiv.org/abs/1706.03741?utm_source=chatgpt.com "Deep reinforcement learning from human preferences"
[44]: https://proceedings.neurips.cc/paper/2020/hash/1f89885d556929e98d3ef9b86448f951-Abstract.html?utm_source=chatgpt.com "Learning to summarize with human feedback"
[45]: https://arxiv.org/abs/1503.02531?utm_source=chatgpt.com "[1503.02531] Distilling the Knowledge in a Neural Network"
[46]: https://arxiv.org/abs/1712.05877?utm_source=chatgpt.com "Quantization and Training of Neural Networks for Efficient Integer-Arithmetic-Only Inference"
[47]: https://arxiv.org/abs/2209.10652?utm_source=chatgpt.com "Toy Models of Superposition"
[48]: https://etc.cuit.columbia.edu/news/basics-language-modeling-transformers-switch-transformer?utm_source=chatgpt.com "The Basics of Language Modeling with Transformers: Switch ..."
[49]: https://dl.acm.org/doi/10.1145/1968.1972?utm_source=chatgpt.com "A theory of the learnable | Communications of the ACM"
[50]: https://www.psychologicalscience.org/observer/the-minimum-description-length-principle?utm_source=chatgpt.com "The Minimum Description Length Principle"
[51]: https://arxiv.org/abs/1503.02406?utm_source=chatgpt.com "Deep Learning and the Information Bottleneck Principle"
[52]: https://en.wikipedia.org/wiki/Minimum_description_length?utm_source=chatgpt.com "Minimum description length"
