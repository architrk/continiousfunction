1) Extended Math Derivation
A unifying frame: “match behavior under a budget”

Let a teacher model define a conditional distribution 
𝑝
𝜃
(
𝑦
∣
𝑥
)
p
θ
	​

(y∣x) (good quality, expensive), and we want a cheaper system 
𝑞
𝜓
(
𝑦
∣
𝑥
)
q
ψ
	​

(y∣x) (student / adapted / quantized / sparse) that behaves similarly under a cost constraint.

 

A clean mental model is the constrained problem

min
⁡
𝜓
  
  
𝐸
𝑥
∼
𝐷
[
𝐷
beh
(
𝑝
𝜃
(
⋅
∣
𝑥
)
,
𝑞
𝜓
(
⋅
∣
𝑥
)
)
]
⏟
match behavior
s.t.
Cost
(
𝜓
)
⏟
latency, FLOPs, memory, bandwidth, 
𝑙
𝑑
𝑜
𝑡
𝑠
≤
𝐵
ψ
min
	​

match behavior
E
x∼D
	​

[D
beh
	​

(p
θ
	​

(⋅∣x),q
ψ
	​

(⋅∣x))]
	​

	​

s.t.
latency, FLOPs, memory, bandwidth, ldots
Cost(ψ)
	​

	​

≤B

Different “efficiency tricks” pick different levers for reducing 
Cost
(
⋅
)
Cost(⋅) while keeping 
𝐷
beh
D
beh
	​

 small.

 

Below are the core equations for the four techniques in the title, with full algebra and shapes.

1. Distillation: KL between softened distributions
Setup + shapes

𝑥
x: input (prompt, image, etc.). For LMs, think of a context of length 
𝑇
𝑥
T
x
	​

 but we’ll treat it abstractly.

𝑉
V: number of classes / vocabulary size.

Teacher logits: 
𝑧
𝜃
(T)
(
𝑥
)
∈
𝑅
𝑉
z
θ
(T)
	​

(x)∈R
V

Student logits: 
𝑧
𝜓
(S)
(
𝑥
)
∈
𝑅
𝑉
z
ψ
(S)
	​

(x)∈R
V

Temperature: 
𝑇
>
0
T>0 (scalar)

Softmax at temperature 
𝑇
T:

𝑝
𝑖
(
𝑇
)
(
𝑥
)
=
𝑒
𝑧
𝑖
(T)
(
𝑥
)
/
𝑇
∑
𝑗
=
1
𝑉
𝑒
𝑧
𝑗
(T)
(
𝑥
)
/
𝑇
,
𝑞
𝑖
(
𝑇
)
(
𝑥
)
=
𝑒
𝑧
𝑖
(S)
(
𝑥
)
/
𝑇
∑
𝑗
=
1
𝑉
𝑒
𝑧
𝑗
(S)
(
𝑥
)
/
𝑇
p
i
(T)
	​

(x)=
∑
j=1
V
	​

e
z
j
(T)
	​

(x)/T
e
z
i
(T)
	​

(x)/T
	​

,q
i
(T)
	​

(x)=
∑
j=1
V
	​

e
z
j
(S)
	​

(x)/T
e
z
i
(S)
	​

(x)/T
	​


So 
𝑝
(
𝑇
)
(
𝑥
)
,
𝑞
(
𝑇
)
(
𝑥
)
∈
Δ
𝑉
p
(T)
(x),q
(T)
(x)∈Δ
V
 (probability simplex).

Key objective

A standard distillation loss is:

𝐿
distill
(
𝑥
)
=
𝑇
2
 
K
L
 ⁣
(
𝑝
(
𝑇
)
(
⋅
∣
𝑥
)
  
∥
  
𝑞
(
𝑇
)
(
⋅
∣
𝑥
)
)
L
distill
	​

(x)=T
2
KL(p
(T)
(⋅∣x)∥q
(T)
(⋅∣x))

Expand the KL (no skipped steps):

K
L
(
𝑝
∥
𝑞
)
	
=
∑
𝑖
=
1
𝑉
𝑝
𝑖
log
⁡
𝑝
𝑖
𝑞
𝑖


	
=
∑
𝑖
=
1
𝑉
𝑝
𝑖
log
⁡
(
𝑝
𝑖
)
−
∑
𝑖
=
1
𝑉
𝑝
𝑖
log
⁡
(
𝑞
𝑖
)
KL(p∥q)
	​

=
i=1
∑
V
	​

p
i
	​

log
q
i
	​

p
i
	​

	​

=
i=1
∑
V
	​

p
i
	​

log(p
i
	​

)−
i=1
∑
V
	​

p
i
	​

log(q
i
	​

)
	​


So:

𝐿
distill
(
𝑥
)
	
=
𝑇
2
[
∑
𝑖
=
1
𝑉
𝑝
𝑖
(
𝑇
)
(
𝑥
)
log
⁡
𝑝
𝑖
(
𝑇
)
(
𝑥
)
]
  
  
−
  
  
𝑇
2
[
∑
𝑖
=
1
𝑉
𝑝
𝑖
(
𝑇
)
(
𝑥
)
log
⁡
𝑞
𝑖
(
𝑇
)
(
𝑥
)
]
L
distill
	​

(x)
	​

=T
2
[
i=1
∑
V
	​

p
i
(T)
	​

(x)logp
i
(T)
	​

(x)]−T
2
[
i=1
∑
V
	​

p
i
(T)
	​

(x)logq
i
(T)
	​

(x)]
	​


The first bracket depends only on the teacher (fixed during student training), so w.r.t. 
𝜓
ψ it’s a constant. Minimizing 
𝐿
distill
L
distill
	​

 is equivalent to minimizing the second term:

min
⁡
𝜓
𝐿
distill
(
𝑥
)
⟺
min
⁡
𝜓
  
  
−
∑
𝑖
=
1
𝑉
𝑝
𝑖
(
𝑇
)
(
𝑥
)
log
⁡
𝑞
𝑖
(
𝑇
)
(
𝑥
)
ψ
min
	​

L
distill
	​

(x)⟺
ψ
min
	​

−
i=1
∑
V
	​

p
i
(T)
	​

(x)logq
i
(T)
	​

(x)

That is, distillation is “cross-entropy with soft labels”.

Gradient derivation (why the 
𝑇
2
T
2
 appears)

Let 
𝑧
∈
𝑅
𝑉
z∈R
V
 denote student logits 
𝑧
=
𝑧
𝜓
(S)
(
𝑥
)
z=z
ψ
(S)
	​

(x), and define

𝑞
𝑖
(
𝑇
)
=
𝑒
𝑧
𝑖
/
𝑇
∑
𝑗
𝑒
𝑧
𝑗
/
𝑇
q
i
(T)
	​

=
∑
j
	​

e
z
j
	​

/T
e
z
i
	​

/T
	​


We’ll derive the gradient of the unscaled cross-entropy term

𝐻
(
𝑝
(
𝑇
)
,
𝑞
(
𝑇
)
)
=
−
∑
𝑖
=
1
𝑉
𝑝
𝑖
(
𝑇
)
log
⁡
𝑞
𝑖
(
𝑇
)
H(p
(T)
,q
(T)
)=−
i=1
∑
V
	​

p
i
(T)
	​

logq
i
(T)
	​


First expand 
log
⁡
𝑞
𝑖
(
𝑇
)
logq
i
(T)
	​

:

log
⁡
𝑞
𝑖
(
𝑇
)
=
log
⁡
(
𝑒
𝑧
𝑖
/
𝑇
∑
𝑗
𝑒
𝑧
𝑗
/
𝑇
)
=
𝑧
𝑖
𝑇
−
log
⁡
(
∑
𝑗
𝑒
𝑧
𝑗
/
𝑇
)
logq
i
(T)
	​

=log(
∑
j
	​

e
z
j
	​

/T
e
z
i
	​

/T
	​

)=
T
z
i
	​

	​

−log(
j
∑
	​

e
z
j
	​

/T
)

Plug into 
𝐻
H:

𝐻
	
=
−
∑
𝑖
𝑝
𝑖
(
𝑇
)
(
𝑧
𝑖
𝑇
−
log
⁡
∑
𝑗
𝑒
𝑧
𝑗
/
𝑇
)


	
=
−
1
𝑇
∑
𝑖
𝑝
𝑖
(
𝑇
)
𝑧
𝑖
  
+
  
(
∑
𝑖
𝑝
𝑖
(
𝑇
)
)
log
⁡
∑
𝑗
𝑒
𝑧
𝑗
/
𝑇
H
	​

=−
i
∑
	​

p
i
(T)
	​

(
T
z
i
	​

	​

−log
j
∑
	​

e
z
j
	​

/T
)
=−
T
1
	​

i
∑
	​

p
i
(T)
	​

z
i
	​

+(
i
∑
	​

p
i
(T)
	​

)log
j
∑
	​

e
z
j
	​

/T
	​


Since 
∑
𝑖
𝑝
𝑖
(
𝑇
)
=
1
∑
i
	​

p
i
(T)
	​

=1:

𝐻
=
−
1
𝑇
∑
𝑖
𝑝
𝑖
(
𝑇
)
𝑧
𝑖
  
+
  
log
⁡
∑
𝑗
𝑒
𝑧
𝑗
/
𝑇
H=−
T
1
	​

i
∑
	​

p
i
(T)
	​

z
i
	​

+log
j
∑
	​

e
z
j
	​

/T

Now differentiate w.r.t. a particular logit 
𝑧
𝑘
z
k
	​

:

First term derivative:

∂
∂
𝑧
𝑘
(
−
1
𝑇
∑
𝑖
𝑝
𝑖
(
𝑇
)
𝑧
𝑖
)
=
−
1
𝑇
𝑝
𝑘
(
𝑇
)
∂z
k
	​

∂
	​

(−
T
1
	​

i
∑
	​

p
i
(T)
	​

z
i
	​

)=−
T
1
	​

p
k
(T)
	​


Second term derivative (log-sum-exp):

Let 
𝑆
=
∑
𝑗
𝑒
𝑧
𝑗
/
𝑇
S=∑
j
	​

e
z
j
	​

/T
. Then 
log
⁡
𝑆
logS derivative:

∂
∂
𝑧
𝑘
log
⁡
𝑆
=
1
𝑆
∂
𝑆
∂
𝑧
𝑘
=
1
𝑆
(
𝑒
𝑧
𝑘
/
𝑇
⋅
1
𝑇
)
=
1
𝑇
𝑒
𝑧
𝑘
/
𝑇
∑
𝑗
𝑒
𝑧
𝑗
/
𝑇
=
1
𝑇
𝑞
𝑘
(
𝑇
)
∂z
k
	​

∂
	​

logS=
S
1
	​

∂z
k
	​

∂S
	​

=
S
1
	​

(e
z
k
	​

/T
⋅
T
1
	​

)=
T
1
	​

∑
j
	​

e
z
j
	​

/T
e
z
k
	​

/T
	​

=
T
1
	​

q
k
(T)
	​


Combine:

∂
𝐻
∂
𝑧
𝑘
=
−
1
𝑇
𝑝
𝑘
(
𝑇
)
+
1
𝑇
𝑞
𝑘
(
𝑇
)
=
1
𝑇
(
𝑞
𝑘
(
𝑇
)
−
𝑝
𝑘
(
𝑇
)
)
∂z
k
	​

∂H
	​

=−
T
1
	​

p
k
(T)
	​

+
T
1
	​

q
k
(T)
	​

=
T
1
	​

(q
k
(T)
	​

−p
k
(T)
	​

)

Now include the 
𝑇
2
T
2
 factor:

𝐿
distill
=
𝑇
2
 
K
L
(
𝑝
(
𝑇
)
∥
𝑞
(
𝑇
)
)
  
  
⇒
  
  
∂
𝐿
distill
∂
𝑧
𝑘
=
𝑇
2
⋅
1
𝑇
(
𝑞
𝑘
(
𝑇
)
−
𝑝
𝑘
(
𝑇
)
)
=
𝑇
(
𝑞
𝑘
(
𝑇
)
−
𝑝
𝑘
(
𝑇
)
)
L
distill
	​

=T
2
KL(p
(T)
∥q
(T)
)⇒
∂z
k
	​

∂L
distill
	​

	​

=T
2
⋅
T
1
	​

(q
k
(T)
	​

−p
k
(T)
	​

)=T(q
k
(T)
	​

−p
k
(T)
	​

)

Practical punchline: without the 
𝑇
2
T
2
, gradients shrink roughly like 
1
/
𝑇
1/T. With the 
𝑇
2
T
2
, you largely “undo” that shrinkage, so you can tune 
𝑇
T for “dark knowledge” without breaking optimization dynamics.

2. Quantization: affine uniform rounding + error propagation

Quantization is “replace real numbers with a discrete grid”, typically to reduce memory bandwidth and storage.

Setup + shapes

Scalar weight 
𝑤
∈
𝑅
w∈R

Bits 
𝑏
∈
𝑁
b∈N, levels 
𝐿
=
2
𝑏
L=2
b

For affine quantization, assume we map 
𝑤
w into the representable range 
[
𝑤
min
⁡
,
𝑤
max
⁡
]
[w
min
	​

,w
max
	​

].

Step size:

Δ
=
𝑤
max
⁡
−
𝑤
min
⁡
𝐿
−
1
Δ=
L−1
w
max
	​

−w
min
	​

	​

Quantize + dequantize (explicit algebra)

Define the integer code 
𝑞
∈
{
0
,
1
,
…
,
𝐿
−
1
}
q∈{0,1,…,L−1}:

𝑞
=
c
l
i
p
(
r
o
u
n
d
(
𝑤
−
𝑤
min
⁡
Δ
)
,
0
,
𝐿
−
1
)
q=clip(round(
Δ
w−w
min
	​

	​

),0,L−1)

Dequantized value 
𝑤
^
∈
𝑅
w
^
∈R is:

𝑤
^
=
𝑤
min
⁡
+
Δ
𝑞
w
^
=w
min
	​

+Δq
Quantization error bound

Let

𝑢
=
𝑤
−
𝑤
min
⁡
Δ
⇒
𝑤
=
𝑤
min
⁡
+
Δ
𝑢
u=
Δ
w−w
min
	​

	​

⇒w=w
min
	​

+Δu

Ignoring clipping for a moment, rounding means:

𝑞
=
r
o
u
n
d
(
𝑢
)
⇒
𝑢
=
𝑞
+
𝛿
with
𝛿
∈
[
−
1
2
,
1
2
]
q=round(u)⇒u=q+δwithδ∈[−
2
1
	​

,
2
1
	​

]

Then:

𝑤
	
=
𝑤
min
⁡
+
Δ
(
𝑞
+
𝛿
)


𝑤
^
	
=
𝑤
min
⁡
+
Δ
𝑞


𝜀
	
:
=
𝑤
^
−
𝑤
=
−
Δ
𝛿
w
w
^
ε
	​

=w
min
	​

+Δ(q+δ)
=w
min
	​

+Δq
:=
w
^
−w=−Δδ
	​


So:

∣
𝜀
∣
≤
Δ
2
∣ε∣≤
2
Δ
	​


If you assume 
𝛿
∼
U
n
i
f
(
−
1
/
2
,
1
/
2
)
δ∼Unif(−1/2,1/2) (a common approximation), then:

𝐸
[
𝜀
2
]
=
Δ
2
𝐸
[
𝛿
2
]
=
Δ
2
⋅
1
12
=
Δ
2
12
E[ε
2
]=Δ
2
E[δ
2
]=Δ
2
⋅
12
1
	​

=
12
Δ
2
	​

How error hits a dot product (one layer)

Consider one linear output:

Weight vector 
𝑤
∈
𝑅
𝑑
w∈R
d

Input 
𝑥
∈
𝑅
𝑑
x∈R
d

Output 
𝑦
=
𝑤
⊤
𝑥
y=w
⊤
x

Quantize weights: 
𝑤
^
=
𝑤
+
𝜀
w
^
=w+ε. Then:

𝑦
^
=
𝑤
^
⊤
𝑥
=
(
𝑤
+
𝜀
)
⊤
𝑥
=
𝑤
⊤
𝑥
+
𝜀
⊤
𝑥
=
𝑦
+
∑
𝑖
=
1
𝑑
𝜀
𝑖
𝑥
𝑖
y
^
	​

=
w
^
⊤
x=(w+ε)
⊤
x=w
⊤
x+ε
⊤
x=y+
i=1
∑
d
	​

ε
i
	​

x
i
	​


If 
𝜀
𝑖
ε
i
	​

 are independent with 
𝐸
[
𝜀
𝑖
]
=
0
E[ε
i
	​

]=0 and 
V
a
r
(
𝜀
𝑖
)
=
Δ
2
/
12
Var(ε
i
	​

)=Δ
2
/12:

V
a
r
(
𝑦
^
−
𝑦
)
=
V
a
r
(
∑
𝑖
=
1
𝑑
𝜀
𝑖
𝑥
𝑖
)
=
∑
𝑖
=
1
𝑑
𝑥
𝑖
2
V
a
r
(
𝜀
𝑖
)
=
Δ
2
12
∥
𝑥
∥
2
2
Var(
y
^
	​

−y)=Var(
i=1
∑
d
	​

ε
i
	​

x
i
	​

)=
i=1
∑
d
	​

x
i
2
	​

Var(ε
i
	​

)=
12
Δ
2
	​

∥x∥
2
2
	​


This is the “why outliers hurt” story in math form: if an outlier forces 
Δ
Δ large, error grows like 
Δ
2
Δ
2
.

Per-channel scaling (why it’s better)

For a weight matrix 
𝑊
∈
𝑅
𝑑
out
×
𝑑
in
W∈R
d
out
	​

×d
in
	​

, per-tensor quantization uses one 
Δ
Δ for everything.

 

Per-channel quantization uses one scale per output row 
𝑖
i:

𝑠
𝑖
=
max
⁡
𝑗
∣
𝑊
𝑖
,
𝑗
∣
2
𝑏
−
1
−
1
,
𝑄
𝑖
,
𝑗
=
r
o
u
n
d
(
𝑊
𝑖
,
𝑗
𝑠
𝑖
)
,
𝑊
^
𝑖
,
𝑗
=
𝑠
𝑖
𝑄
𝑖
,
𝑗
s
i
	​

=
2
b−1
−1
max
j
	​

∣W
i,j
	​

∣
	​

,Q
i,j
	​

=round(
s
i
	​

W
i,j
	​

	​

),
W
^
i,j
	​

=s
i
	​

Q
i,j
	​


It’s the same rounding math, but now each row has a smaller effective 
Δ
Δ, so most rows don’t pay for a few “wide-range” rows.

3. LoRA: constrain the weight update to rank 
𝑟
r

LoRA is easiest to understand as “fine-tuning, but you force the change in weights to live in a low-dimensional subspace”.

Setup + shapes

A dense linear layer weight: 
𝑊
∈
𝑅
𝑑
out
×
𝑑
in
W∈R
d
out
	​

×d
in
	​


Input activation: 
𝑥
∈
𝑅
𝑑
in
x∈R
d
in
	​


Output: 
𝑦
∈
𝑅
𝑑
out
y∈R
d
out
	​


LoRA rank: 
𝑟
≪
min
⁡
(
𝑑
in
,
𝑑
out
)
r≪min(d
in
	​

,d
out
	​

)

LoRA factors:

𝐴
∈
𝑅
𝑟
×
𝑑
in
A∈R
r×d
in
	​


𝐵
∈
𝑅
𝑑
out
×
𝑟
B∈R
d
out
	​

×r

Parameterization

LoRA defines the adapted weight:

𝑊
′
=
𝑊
+
𝐵
𝐴
W
′
=W+BA

Compute output:

𝑦
′
	
=
𝑊
′
𝑥
=
(
𝑊
+
𝐵
𝐴
)
𝑥


	
=
𝑊
𝑥
+
𝐵
𝐴
𝑥


	
=
𝑊
𝑥
+
𝐵
(
𝐴
𝑥
)
y
′
	​

=W
′
x=(W+BA)x
=Wx+BAx
=Wx+B(Ax)
	​


Define the low-dim “adapter state” 
𝑢
=
𝐴
𝑥
∈
𝑅
𝑟
u=Ax∈R
r
. Then:

𝑦
′
=
𝑊
𝑥
+
𝐵
𝑢
y
′
=Wx+Bu

So LoRA adds a rank-
𝑟
r correction by:

projecting 
𝑥
x down to 
𝑟
r numbers,

expanding back up to 
𝑑
out
d
out
	​

.

Why 
r
a
n
k
(
𝐵
𝐴
)
≤
𝑟
rank(BA)≤r (two proofs)

Proof 1 (column space containment).
The image of 
𝐵
𝐴
BA is contained in the column space of 
𝐵
B.

 

Take any 
𝑥
∈
𝑅
𝑑
in
x∈R
d
in
	​

. Then 
𝐴
𝑥
∈
𝑅
𝑟
Ax∈R
r
. Multiply by 
𝐵
B:

𝐵
𝐴
𝑥
=
𝐵
(
𝐴
𝑥
)
∈
Col
(
𝐵
)
BAx=B(Ax)∈Col(B)

So 
Im
(
𝐵
𝐴
)
⊆
Col
(
𝐵
)
Im(BA)⊆Col(B). Therefore:

r
a
n
k
(
𝐵
𝐴
)
≤
dim
⁡
(
Col
(
𝐵
)
)
=
r
a
n
k
(
𝐵
)
≤
𝑟
rank(BA)≤dim(Col(B))=rank(B)≤r

Proof 2 (sum of rank-1 matrices).
Write 
𝐵
=
[
𝑏
1
,
…
,
𝑏
𝑟
]
B=[b
1
	​

,…,b
r
	​

] where each 
𝑏
𝑘
∈
𝑅
𝑑
out
b
k
	​

∈R
d
out
	​

, and write rows of 
𝐴
A as 
𝐴
=
[
𝑎
1
⊤


⋮


𝑎
𝑟
⊤
]
A=
	​

a
1
⊤
	​

⋮
a
r
⊤
	​

	​

	​

 with 
𝑎
𝑘
∈
𝑅
𝑑
in
a
k
	​

∈R
d
in
	​

. Then:

𝐵
𝐴
=
∑
𝑘
=
1
𝑟
𝑏
𝑘
𝑎
𝑘
⊤
BA=
k=1
∑
r
	​

b
k
	​

a
k
⊤
	​


Each 
𝑏
𝑘
𝑎
𝑘
⊤
b
k
	​

a
k
⊤
	​

 has rank 
≤
1
≤1. The sum cannot have rank more than 
𝑟
r.

Parameter count reduction

Full fine-tune parameters: 
#
𝑊
=
𝑑
out
𝑑
in
#W=d
out
	​

d
in
	​


LoRA trainable parameters:

#
(
𝐴
,
𝐵
)
=
𝑟
𝑑
in
+
𝑑
out
𝑟
=
𝑟
(
𝑑
in
+
𝑑
out
)
#(A,B)=rd
in
	​

+d
out
	​

r=r(d
in
	​

+d
out
	​

)

Ratio:

#
(
𝐴
,
𝐵
)
#
𝑊
=
𝑟
(
𝑑
in
+
𝑑
out
)
𝑑
out
𝑑
in
#W
#(A,B)
	​

=
d
out
	​

d
in
	​

r(d
in
	​

+d
out
	​

)
	​


When 
𝑑
out
=
𝑑
in
=
𝑑
d
out
	​

=d
in
	​

=d, this becomes 
≈
2
𝑟
𝑑
≈
d
2r
	​

.
So for 
𝑑
=
4096
d=4096, 
𝑟
=
16
r=16, you’re training 
∼
0.78
%
∼0.78% of the parameters in that matrix.

4. Sparse MoE: conditional compute with top‑
𝑘
k routing

MoE gives you many parameter sets (“experts”), but you only execute a few per token.

Setup + shapes

Hidden state per token: 
ℎ
∈
𝑅
𝑑
h∈R
d

Number of experts: 
𝐸
E

Router weights: 
𝑊
𝑟
∈
𝑅
𝐸
×
𝑑
W
r
	​

∈R
E×d

Router logits: 
𝑎
=
𝑊
𝑟
ℎ
∈
𝑅
𝐸
a=W
r
	​

h∈R
E

Router probabilities: 
𝑔
=
s
o
f
t
m
a
x
(
𝑎
)
∈
Δ
𝐸
g=softmax(a)∈Δ
E

Each expert: 
𝑓
𝑒
:
𝑅
𝑑
→
𝑅
𝑑
f
e
	​

:R
d
→R
d
 (often an MLP with its own weights)

Top‑
𝑘
k set: 
𝑆
=
T
o
p
K
(
𝑔
,
𝑘
)
⊂
{
1
,
…
,
𝐸
}
S=TopK(g,k)⊂{1,…,E}

MoE layer definition (with renormalization)

A common MoE output is:

M
o
E
(
ℎ
)
=
∑
𝑒
∈
𝑆
𝑔
~
𝑒
 
𝑓
𝑒
(
ℎ
)
where
𝑔
~
𝑒
=
𝑔
𝑒
∑
𝑗
∈
𝑆
𝑔
𝑗
MoE(h)=
e∈S
∑
	​

g
~
	​

e
	​

f
e
	​

(h)where
g
~
	​

e
	​

=
∑
j∈S
	​

g
j
	​

g
e
	​

	​


This renormalization ensures 
∑
𝑒
∈
𝑆
𝑔
~
𝑒
=
1
∑
e∈S
	​

g
~
	​

e
	​

=1 even though we dropped most experts.

Compute vs parameter cost

Let:

𝐶
expert
C
expert
	​

 = cost of one expert forward pass for one token (FLOPs)

𝐶
router
C
router
	​

 = router cost (typically small)

Dense (one shared FFN): 
≈
𝐶
expert
≈C
expert
	​


 

Sparse MoE: 
≈
𝐶
router
+
𝑘
 
𝐶
expert
≈C
router
	​

+kC
expert
	​


 

But parameter count scales with 
𝐸
E: total expert weights are 
≈
𝐸
≈E times bigger than a single FFN.

 

That’s the MoE bargain:

capacity 
↑
↑ like 
𝐸
E

active compute 
↑
↑ like 
𝑘
k (with 
𝑘
≪
𝐸
k≪E)

Load-balancing loss (step-by-step)

Without regularization, routers can collapse: “send everything to one expert”. A common fix is an auxiliary loss.

 

For a batch with 
𝐵
B tokens (or token positions):

Router probs for token 
𝑡
t: 
𝑔
(
𝑡
)
∈
Δ
𝐸
g
(t)
∈Δ
E

Top‑
𝑘
k mask 
𝑚
𝑒
(
𝑡
)
∈
{
0
,
1
}
m
e
(t)
	​

∈{0,1} indicates whether expert 
𝑒
e is selected for token 
𝑡
t

Define:

Load (frequency) for expert 
𝑒
e:

𝑓
𝑒
=
1
𝐵
∑
𝑡
=
1
𝐵
𝑚
𝑒
(
𝑡
)
f
e
	​

=
B
1
	​

t=1
∑
B
	​

m
e
(t)
	​


Importance (avg probability) for expert 
𝑒
e:

𝑃
𝑒
=
1
𝐵
∑
𝑡
=
1
𝐵
𝑔
𝑒
(
𝑡
)
P
e
	​

=
B
1
	​

t=1
∑
B
	​

g
e
(t)
	​


A widely used auxiliary loss is:

𝐿
LB
=
𝐸
∑
𝑒
=
1
𝐸
𝑓
𝑒
𝑃
𝑒
L
LB
	​

=E
e=1
∑
E
	​

f
e
	​

P
e
	​


Why does it punish collapse? Check two extremes:

Uniform routing: 
𝑓
𝑒
=
𝑘
𝐸
f
e
	​

=
E
k
	​

 (each token picks 
𝑘
k experts evenly), 
𝑃
𝑒
=
1
𝐸
P
e
	​

=
E
1
	​


𝐿
LB
=
𝐸
⋅
∑
𝑒
=
1
𝐸
(
𝑘
𝐸
⋅
1
𝐸
)
=
𝐸
⋅
𝐸
⋅
𝑘
𝐸
2
=
𝑘
L
LB
	​

=E⋅
e=1
∑
E
	​

(
E
k
	​

⋅
E
1
	​

)=E⋅E⋅
E
2
k
	​

=k

Collapsed routing: all tokens go to expert 1 with prob 1:

𝑓
1
=
𝑘
f
1
	​

=k, 
𝑃
1
=
1
P
1
	​

=1; all others 
0
0

𝐿
LB
=
𝐸
⋅
(
𝑘
⋅
1
)
=
𝐸
𝑘
L
LB
	​

=E⋅(k⋅1)=Ek

So collapse costs 
≈
𝐸
×
≈E× more auxiliary loss than uniform. Minimizing this pushes the router away from collapse.

3–5 practitioner “rules of thumb”

Pick the trick that matches the bottleneck.

If you’re memory-bandwidth bound (common in decode-time inference): start with quantization.

If you’re training lots of variants: start with LoRA.

If you need a fast cheap model with similar behavior: distillation.

If you need more capacity at similar FLOPs: sparse MoE (but expect engineering complexity).

Quantization fails on outliers before it fails on “average precision”.
Per-channel scales, clipping, and “keep some layers in higher precision” usually matter more than arguing about 8-bit vs 4-bit in the abstract.

In distillation, temperature 
𝑇
T is not “make it smoother” — it’s “reveal relative preferences”.
Higher 
𝑇
T makes non-top classes/tokens carry gradient signal. The 
𝑇
2
T
2
 factor keeps gradients sane.

LoRA rank 
𝑟
r is a capacity knob, not a magic constant.
Start small (e.g., 
𝑟
∈
{
4
,
8
,
16
}
r∈{4,8,16}), then increase only if your validation loss plateaus early. Many tasks are low-rank in the update space.

MoE speedups are gated by communication and load balance, not only FLOPs.
If experts aren’t well-balanced, you’ll hit stragglers and lose the theoretical 
𝐸
/
𝑘
E/k benefit.

2) Teaching Narrative

When people say “this model is too big,” they usually mean something more specific: it’s too slow, it doesn’t fit, it’s too expensive to fine-tune, or it’s too expensive to serve at scale. The tricky part is that these are different problems. Efficiency isn’t one trick; it’s a menu of ways to pay less by changing what you spend: bytes moved, FLOPs executed, parameters trained, or subnetworks activated.

 

A helpful metaphor is: you’re trying to ship the same function through a narrower pipe. Quantization narrows the pipe by making each number cheaper to move. Distillation narrows the pipe by building a smaller function that imitates the teacher’s behavior. LoRA narrows the pipe by saying “don’t relearn the whole function; only learn a low-dimensional correction.” Sparse MoE narrows the pipe by saying “keep lots of parameters available, but only execute a few for each token.”

 

The “aha moment” is that all four are controlled approximations:

quantization ≈ discretize weights/activations with bounded error,

distillation ≈ match teacher distributions (not just hard labels),

LoRA ≈ restrict the update to a low-rank subspace,

MoE ≈ restrict compute to a sparse subset of experts.

Once you see them as approximations, trade-offs feel less mysterious: every technique is basically deciding where you allow error (numbers, updates, routing) and how you keep that error from compounding (calibration, scaling factors, load balancing, selective high precision).

Common misconceptions (and fixes)

“Quantization is just compressing weights; accuracy shouldn’t change much.”
It often works well, but the failure mode is predictable: outliers inflate your scale 
Δ
Δ, and the whole layer pays. Fix: per-channel scales, clipping, keep sensitive ops (norms, embeddings, logits) in higher precision.

“Distillation is training on the teacher’s argmax.”
That’s just pseudo-labeling. Distillation’s real leverage is the full distribution 
𝑝
(
𝑇
)
p
(T)
, especially at higher temperature, which transfers “this is the second-best choice” information.

“LoRA is basically regularization / smaller learning rate.”
Not quite: LoRA is a hard constraint on the rank of the weight update. You’re not just training less; you’re training in a specific low-dimensional subspace 
Δ
𝑊
=
𝐵
𝐴
ΔW=BA.

“MoE is always cheaper because it’s sparse.”
Sparse compute can still be expensive if routing causes imbalance or if dispatch/combine communication dominates. MoE is systems-heavy; you need to account for all-to-all and stragglers.

3) Code Example (Python, ≤40 lines)

This snippet demonstrates (1) distillation gradient scaling with 
𝑇
2
T
2
, (2) LoRA rank constraint, (3) quantization reconstruction error, and (4) MoE routing load + compute ratio.

python
Copy code
import torch
torch.manual_seed(0)

V=12; z_t=torch.randn(V); z_s0=torch.randn(V)
def loss_grad(T, scale_T2):
    z=z_s0.clone().requires_grad_(True)
    p=torch.softmax(z_t/T,0); q=torch.softmax(z/T,0)
    kl=(p*(p.log()-q.log())).sum()
    loss=(T*T*kl if scale_T2 else kl); loss.backward()
    return loss.item(), z.grad.norm().item()

for scale in (False, True):
    for T in (1.,4.):
        L,g=loss_grad(T,scale)
        print(f"scale_T2={scale} T={T}: loss={L:.4f} grad_norm={g:.4f}")

d=64; r=4
A=torch.randn(r,d,dtype=torch.float64); B=torch.randn(d,r,dtype=torch.float64); delta=B@A
rank=int((torch.linalg.svdvals(delta)>1e-8).sum())
print(f"LoRA: rank(BA)={rank} ≤ r={r}; trainable={r*(2*d)} / full={d*d}")

W=torch.randn(d,d); b=4; qmax=2**b-1
wmin,wmax=W.min(),W.max(); Delta=(wmax-wmin)/qmax
Wq=torch.round((W-wmin)/Delta).clamp(0,qmax); What=Wq*Delta+wmin
print(f"Quantization: {b}-bit rel_error={((What-W).norm()/W.norm()):.3f}")

E,k,N=8,2,2000
topk=torch.softmax(torch.randn(N,E),1).topk(k,1).indices
load=torch.bincount(topk.reshape(-1),minlength=E).float()/(N*k)
print(f"MoE: E={E}, top-k={k}, max_load={load.max():.3f}, dense/sparse≈{E/k:.1f}×")


Sample output (deterministic with the seed):

text
Copy code
scale_T2=False T=1.0: loss=1.1869 grad_norm=0.4337
scale_T2=False T=4.0: loss=0.0722 grad_norm=0.0272
scale_T2=True T=1.0: loss=1.1869 grad_norm=0.4337
scale_T2=True T=4.0: loss=1.1545 grad_norm=0.4345
LoRA: rank(BA)=4 ≤ r=4; trainable=512 / full=4096
Quantization: 4-bit rel_error=0.154
MoE: E=8, top-k=2, max_load=0.134, dense/sparse≈4.0×


What to sanity-check:

With scale_T2=False, the gradient norm collapses at 
𝑇
=
4
T=4. With scale_T2=True, it stays comparable.

rank(BA) equals 
𝑟
r.

Quantization error is nonzero but modest for random weights.

MoE shows an approximate compute ratio 
𝐸
/
𝑘
E/k and a max-load diagnostic.

4) Interactive Demo Design (React + Canvas/D3)

You already have EfficiencyViz as a tabbed wrapper (content/domains/efficiency/concepts/efficiency/viz.tsx) that dynamically imports:

LoRAViz

MoERoutingViz

TaskVectorViz (bonus / duplicated in representations)

For “production quality” aligned with the title, I’d implement two new demos and slightly refactor the tab list.

Proposed tab set (match the title)

Tabs (in order):

Quantization

Distillation

LoRA

Sparse MoE
(Optional 5) Task Vectors as “Bonus”)

Implementation changes

Add new components:

components/foundations/QuantizationViz.tsx

components/foundations/DistillationViz.tsx

Update content/domains/efficiency/concepts/efficiency/viz.tsx:

Add the dynamic imports.

Update TabId union.

Add tabs with notes.

Update data/visualizationMappings.ts:

efficiency: ['QuantizationViz','DistillationViz','LoRAViz','MoERoutingViz']

Keep TaskVectorViz only if you want the bonus tab.

QuantizationViz (Canvas + D3 axes)

Goal: Make quantization feel like “rounding to a grid” and show how outliers drive 
Δ
Δ and error.

 

Layout

Left: histogram of weights 
𝑊
W (or activations) + overlay of quantization bins.

Right: output error visualization for a toy layer 
𝑦
=
𝑊
𝑥
y=Wx:

line plot of 
∣
𝑦
^
−
𝑦
∣
∣
y
^
	​

−y∣ over output index

and a scalar metric: relative Frobenius error 
∥
𝑊
^
−
𝑊
∥
𝐹
/
∥
𝑊
∥
𝐹
∥
W
^
−W∥
F
	​

/∥W∥
F
	​

.

Interactivity

Slider: bits 
𝑏
b: [2, 8] (default 4)

Toggle: per-tensor vs per-channel (default per-channel)

Slider: clip percentile: [90, 100] (default 99.5)
(implements “ignore extreme outliers to shrink 
Δ
Δ”)

Toggle: quantize activations too (default off)
When on, show that activation quantization can be harsher than weight-only.

Button: resample weights (regenerate distribution + a few synthetic outliers)

Animation

When 
𝑏
b changes: animate bin edges and snapping of sample points to nearest level.

When clip changes: animate shrinking range; show how error decreases for the bulk but increases for clipped outliers (explicitly show “clipped mass %”).

Why it reinforces intuition
Users visually see:

fewer bits → fewer bins → larger rounding jumps,

outliers widen bins even when most weights are small,

per-channel reduces bin width for most rows.

DistillationViz (D3 bars + lightweight animation loop)

Goal: Make “match the teacher distribution” tangible, and make the 
𝑇
2
T
2
 gradient scaling visible.

 

Core objects

Distributions over 
𝑉
=
10
V=10 classes (bars):

teacher 
𝑝
(
𝑇
)
p
(T)

student 
𝑞
(
𝑇
)
q
(T)

Student logits 
𝑧
z are the actual state.

Interactivity

Slider: temperature 
𝑇
T: [0.5, 10] (default 2)

Toggle: include 
𝑇
2
T
2
 factor (default on)

Slider: mix with hard labels 
𝛼
α: [0, 1] (default 1 for pure distill)

show combined loss 
(
1
−
𝛼
)
C
E
(
𝑦
,
𝑞
)
+
𝛼
𝑇
2
K
L
(
𝑝
(
𝑇
)
∥
𝑞
(
𝑇
)
)
(1−α)CE(y,q)+αT
2
KL(p
(T)
∥q
(T)
)

Drag: student logits by dragging bars (updates 
𝑧
z)

Button: take one gradient step (or play/pause)

Animation

“Play” runs a tiny gradient descent loop updating 
𝑧
z toward teacher.

Add a small vector arrow next to each student bar showing 
∂
𝐿
/
∂
𝑧
𝑖
∂L/∂z
i
	​

.

When toggling 
𝑇
2
T
2
: animate arrow magnitudes changing dramatically (this is the “ohhh” moment).

Why it reinforces intuition
Users see:

high 
𝑇
T spreads teacher mass → student learns second/third choices,

without 
𝑇
2
T
2
, gradients vanish at high 
𝑇
T,

with 
𝑇
2
T
2
, optimization stays alive.

LoRAViz (keep existing, but add two “production” affordances)

If your current LoRAViz already shows low-rank structure, I’d add:

 

Interactivity

Slider: rank 
𝑟
r: [1, 64] (default 8)

Toggle: show singular values of 
Δ
𝑊
ΔW (plot of 
𝜎
𝑖
σ
i
	​

)

Toggle: “merge weights” view: show that at inference you can fold 
𝐵
𝐴
BA into 
𝑊
W

Animation

“Training” animation: start from 
Δ
𝑊
=
0
ΔW=0 and approach a target 
Δ
𝑊
\*
ΔW
\*
 (synthetic) while restricted to rank 
𝑟
r. Plot approximation error vs time and vs 
𝑟
r.

MoERoutingViz (keep existing, but add load balancing + compute accounting)

Your MoERoutingViz likely already draws token→expert routing. Make it “production-grade” by adding:

 

Interactivity

Slider: #experts 
𝐸
E: [2, 32] (default 8)

Slider: top‑
𝑘
k: [1, 4] (default 2)

Slider: router temperature 
𝜏
𝑟
τ
r
	​

: [0.2, 2.0] (default 1.0)

Slider: load-balance weight 
𝜆
λ: [0, 1] (default 0.1)

Slider: capacity factor: [1.0, 2.0] (default 1.25)
(visualize dropped tokens when capacity is too low)

Animation

Stream tokens (points in 2D), route them each frame, update:

expert load histogram (bars)

a “straggler” indicator (max load / mean load)

a simple compute panel:

“Dense compute per token: 
𝐸
E experts” (baseline for intuition)

“MoE active compute: 
𝑘
k experts”

“Theoretical ratio: 
𝐸
/
𝑘
E/k”

“But dispatch cost: ~all-to-all” (just as a qualitative label)

Why it reinforces intuition
Users see the real MoE tension:

low 
𝜏
𝑟
τ
r
	​

 → specialization but collapse risk,

balancing → more even loads but can reduce specialization,

capacity factor → practical “drop” failure mode.

5) Graph Connections (repo-aligned)

You already have concept.yaml fields: prerequisites, leads_to, related. Here’s a decisive set that matches how the rest of the map is structured (hub → sub-techniques → serving).

Recommended concept.yaml edges (drop-in update)
yaml
Copy code
prerequisites:
  - maximum-likelihood          # KL / cross-entropy for distillation
  - attention-transformers      # where LoRA + MoE are applied in practice
  - loss-landscapes             # why low-rank updates / constraints can work

leads_to:
  - knowledge-distillation
  - quantization
  - pruning
  - mixture-of-experts
  - llm-serving                 # deployment bottlenecks where these matter
  - moe-serving                 # MoE-specific systems work

related:
  - efficient-attention
  - flash-attention
  - activation-checkpointing
  - speculative-decoding        # draft models often come from distillation
  - scaling-laws                # why efficiency becomes mandatory at scale
  - distributed-training        # comms often dominates “efficient” designs


This keeps efficiency as the conceptual hub and points readers to the concrete “how” concepts that already exist in foundationsData.ts.

Optional: add a few typed semantic relations (high leverage “aha” edges)

In data/foundationsData.ts (conceptRelations), these additions usually pay off:

efficiency -> llm-serving as same_trick: “Bandwidth bottleneck”

quantization -> llm-serving as invented_to_fix: “Fit in VRAM / reduce bytes moved”

knowledge-distillation -> speculative-decoding as invented_to_fix: “Need fast draft model”

mixture-of-experts -> moe-serving as invented_to_fix: “Serving complexity”

(These complement your existing efficiency -> reward-hacking and adam -> efficiency relations.)

Missing prerequisites to create (P0 tasks)

These are the “holes” you’ll keep feeling when writing production-grade explanations and demos:

low-rank-approximation
Title: Low-Rank Approximation: SVD, Truncated SVD, and Why Rank‑r Works
Needed for LoRA intuition beyond “it’s smaller”.

numerical-precision
Title: Numerical Precision: Floating Point, Rounding, and Quantization Error
Needed for quantization error bounds and “outliers” to feel inevitable, not magical.

roofline-model
Title: The Roofline Model: When You’re Compute‑Bound vs Bandwidth‑Bound
Needed to consistently answer “why did int4 make this faster on GPU but not on CPU?” and to ground the “pick the trick that matches the bottleneck” rule.

If you create these as concepts, efficiency becomes a clean hub: math foundations → efficiency lens → concrete techniques → serving systems.
