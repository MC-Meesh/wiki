# Text-to-CAD Literature Survey: Relevance to Direct Voxel Generation

**Date:** 2026-04-26  
**Purpose:** Survey of text-to-CAD literature for the text-to-voxel PoC project. Covers dominant paradigms, their failure modes, and what is transferable to a direct discrete voxel generation approach.

---

## Executive Summary

The text-to-CAD field has converged overwhelmingly on a single paradigm: **LLM → CadQuery/Python code → execute → B-rep or mesh**. This pipeline emerged because (1) LLMs already know Python, (2) CadQuery is a clean high-level API, and (3) execution provides a free validity signal. However, this paradigm has fundamental failure modes that direct voxel generation sidesteps entirely. The most transferable finding for voxel generation is the **SFT + GRPO with geometric reward** training pipeline, which is representation-agnostic and can be directly ported to supervise a token-sequence voxel model.

---

## Paper-by-Paper Analysis

### 1. DeepCAD (ICCV 2021)
**arXiv:** 2105.09492

| Attribute | Detail |
|---|---|
| Output representation | CAD command sequence (sketch + extrude operations as discrete tokens) |
| Model architecture | Transformer autoencoder; encoder/decoder each ~4 layers, ~10M params |
| Dataset | 178,238 Onshape models; command sequences as JSON; **publicly available** |
| Geometric metrics | Coverage, Minimum Matching Distance (MMD), Jensen-Shannon Divergence on geometric properties |
| Text conditioning | None — unconditional generation and autocompletion only |

**Architecture detail:** Each command has a type token (line/arc/circle/loop-sep/extrude = 5 types) and parameter tokens (coordinates, angles, extrusion distances, boolean ops). Coordinates are quantized. The analogy to language is explicit: command type ≈ part-of-speech, parameters ≈ word content. Autoregressive generation with teacher forcing.

**Relevance to voxel:** DeepCAD is the *foundational dataset* for almost all subsequent text-to-CAD work. The command sequence tokenization is conceptually identical to what you would do with voxel blocks — discrete tokens in a learned order. The dataset itself is not voxel data but is the source for Text2CAD annotations, which gives you 170K+ text-shape pairs. The key insight: they chose `[type, param1, param2, ...]` as the token encoding rather than raw coordinates; an equivalent design for voxels is `[block_id, x, y, z]` vs. flattened grid index.

---

### 2. Text2CAD (NeurIPS 2024 Spotlight)
**arXiv:** 2409.17106

| Attribute | Detail |
|---|---|
| Output representation | CAD command sequence (same tokenization as DeepCAD: sketch primitives + extrusions) |
| Model architecture | BERT encoder (pretrained, frozen) + 1 adaptive layer + 8-layer decoder (d=256, 8 heads) |
| Dataset | ~170K models × 4 annotation levels = ~660K text-CAD pairs; annotations via Mixtral-50B + LLaVA-NeXT; **publicly on HuggingFace** |
| Geometric metrics | Arc/Line/Circle F1, Chamfer Distance, Invalidity Ratio, GPT-4V preference, user study |
| Text conditioning | BERT text embeddings cross-attended into CAD decoder |

**Architecture detail:** Relatively small model — the CAD decoder is ~10-20M parameters. Context length 272 CAD tokens. Trained on 1 A100 for 2 days at 160 epochs using teacher forcing + cross-entropy. Input text has 4 complexity levels from abstract ("a rectangular solid") to expert ("box with width=23.4mm, three cylindrical holes of diameter 5mm").

**Key weakness:** Limited to rectangular and cylindrical shape primitives. Complex geometries degrade to "stacks of cubes" — a direct symptom of the constrained command vocabulary. Still fundamentally a *code* paradigm even though it's structured differently from CadQuery.

**Relevance to voxel:** This is the closest prior work in spirit to what you're building — a dedicated non-LLM transformer trained from scratch on a structured discrete representation, conditioned on text embeddings. The BERT encoder + cross-attention decoder pattern is a clean baseline. The 4-level annotation pipeline is worth studying for auto-captioning strategy. The dataset itself (with its 170K text-shape pairs) is a template for what you need.

---

### 3. Text-to-CadQuery (arXiv 2505.06507)
**arXiv:** 2505.06507

| Attribute | Detail |
|---|---|
| Output representation | CadQuery Python code |
| Model architecture | SFT on 6 decoder-only LLMs: CodeGPT-124M, GPT-2 medium/large, Gemma3-1B, Qwen2.5-3B (best), Mistral-7B |
| Dataset | ~170K text-CadQuery pairs; CadQuery code auto-generated from DeepCAD by Gemini 2.0 Flash with iterative self-correction; **likely public** |
| Geometric metrics | Chamfer Distance, Invalidity Rate, F1, Volumetric IoU, Gemini VLM evaluation |
| RL/reward | Standard cross-entropy SFT only — no geometric reward (noted as "non-trivial") |

**Architecture detail:** Context window 1024 tokens covers 94% of samples. Best model is Qwen2.5-3B with full-parameter SFT. Mistral-7B uses 4-bit QLoRA (r=16, α=32). Best results: 69.3% Gemini eval accuracy, median CD=0.191×10³, IR=6.5%.

**Key finding:** They explicitly note that geometric reward integration is expensive and left as future work. The model sometimes hallucinates non-existent CadQuery APIs (e.g., `Workplane.scale()`). Generation fails entirely when the code doesn't execute.

**Relevance to voxel:** The dataset pipeline (Gemini-generated code + iterative self-correction) is a useful template for auto-labeling strategies. The comparison across model sizes shows that 3B parameters is sufficient for this task when output is a constrained structured format — directly relevant to your sizing decision.

---

### 4. CAD-Coder (NeurIPS 2025)
**arXiv:** 2505.19713

| Attribute | Detail |
|---|---|
| Output representation | CadQuery Python code + chain-of-thought `<think>` blocks |
| Model architecture | Qwen2.5-7B-Instruct; Stage 1: SFT 8 epochs; Stage 2: GRPO RL |
| Dataset | 110K text-CadQuery-3D triplets filtered by CD from Text2CAD source; 8K high-quality (CD<1e-4), 70K medium, 32K hard; 1.5K CoT samples for cold-start |
| Geometric metrics | Mean/Median Chamfer Distance, Invalidity Ratio |
| RL/reward | **GRPO with composite reward: R = λ_geo·R_geo + λ_fmt·R_fmt** |

**Architecture detail — geometric reward:**
```
R_geo = f(CD):
  CD < 1e-5  → 1.0
  CD > 0.5   → 0.0
  else       → linear interpolation
```
Execution pipeline: generate code → execute in CadQuery → sample point cloud → compute bidirectional Chamfer Distance vs. ground truth. Format reward checks for `<think>...</think>` block via regex. GRPO generates 8 candidates per prompt, computes relative advantage within the group.

**Training failure mode discovered:** During RL training, the model can enter a mode of generating invalid CadQuery code consistently, which blocks CD computation and stops gradient flow. CoT cold-start (1.5K curated examples with reasoning traces) prevents this collapse. This is a critical engineering detail for a voxel RL pipeline.

**Key results:** Mean CD 6.54×10⁻³ vs. Text2CAD baseline 29.29×10⁻³ — ~4.5× improvement. Invalidity ratio 1.45%.

**Relevance to voxel:** **Highest relevance of any paper here.** The SFT + GRPO pipeline with geometric reward is directly transferable. For voxels: replace CD computation with voxel IoU (which is cheaper — no point cloud sampling needed, just grid comparison). The composite reward pattern (geometric + format/validity) translates to (IoU + non-empty structure). The cold-start anti-collapse strategy is directly applicable: ensure early training samples have valid voxel outputs before turning on RL.

---

### 5. ReCAD (arXiv 2512.06328)
**arXiv:** 2512.06328

| Attribute | Detail |
|---|---|
| Output representation | CadQuery code |
| Model architecture | Qwen2.5-VL-7B-Instruct (vision-language); SFT then GRPO |
| Dataset | ~90K DeepCAD models; SFT mix: 254K in-house + 85K UltraChat + 20K OpenCodeReasoning |
| Geometric metrics | Chamfer Distance, Invalidity Ratio, Primitive F1, IOUbest |
| RL/reward | GRPO with IoU-based reward + DINOv2 image similarity + format reward; guided learning curriculum |

**Reward formulation:**
```
R(y, Ω) = λ₁ · min{IOUbest(Ω̂, Ω), φ(sim(Î, I), τ)} + λ₂ · R_fmt
λ₁=0.1, λ₂=0.9
```
IoU computed under optimal alignment; DINOv2 cosine similarity on rendered images. Curriculum: curves → loops → faces → sketches → extrusions (5 levels of increasing complexity). Hard samples (reward < τ_h=0.8) receive off-policy guidance from parametric code.

**Relevance to voxel:** The IoU reward formulation and hierarchical curriculum learning are directly portable. For voxels, IoU is the natural metric (no rendering or point-cloud sampling required). The curriculum idea (simple shapes first, complex later) is worth adopting.

---

### 6. STEP-LLM (DATE 2026)
**arXiv:** 2601.12641

| Attribute | Detail |
|---|---|
| Output representation | ISO 10303-21 STEP files (B-rep graph serialized as text) |
| Model architecture | Llama-3.2-3B or Qwen2.5-3B with LoRA; SFT + GRPO |
| Dataset | ~40K STEP-caption pairs from ABC dataset; captioned by GPT-4o |
| Geometric metrics | Completion Rate, Renderability Rate, Median Scaled Chamfer Distance |
| RL/reward | GRPO with Scaled Chamfer Distance (SCD) reward; normalized for translation/rotation/scale |

**Architecture detail:** DFS-based reserialization converts STEP's graph structure into a locality-preserving linear sequence. CoT-style annotations add structural metadata. RAG retrieves similar STEP examples for in-context conditioning.

**Reward:** SCD = CD / scale², with piecewise reward mapping (δ_low=0.01, δ_high=0.5). Best result: MSCD 0.098 vs. 3.99 baseline.

**Relevance to voxel:** The STEP serialization problem (graph → linear sequence) is analogous to the voxel ordering problem (3D grid → token sequence). Their DFS traversal insight maps to Morton/Z-curve ordering for voxels. The scale-normalized CD is useful when training shapes vary in size.

---

### 7. ToolCAD (arXiv 2604.07960)
**arXiv:** 2604.07960

| Attribute | Detail |
|---|---|
| Output representation | Tool calls to FreeCAD via MCP interface (not raw code) |
| Model architecture | GPT-4o / Qwen3-235B (frontier); Qwen2.5-7B / Qwen3-8B (open-source, SFT+AWR) |
| Dataset | 982 trajectories from DeepCAD/Text2CAD L3 annotations; 782 train, 200 eval |
| Geometric metrics | Success rate (execution + visual match) |
| RL/reward | Online curriculum GRPO + outcome reward model + step-level execution signals |

**Relevance to voxel:** The step-level execution reward is interesting — getting a signal at each generation step rather than only at the end. For voxels, an analogous signal could be "partial structure validity" or "cross-section coherence" at intermediate generation steps.

---

### 8. Query2CAD (arXiv 2406.00144)
**arXiv:** 2406.00144

| Attribute | Detail |
|---|---|
| Output representation | Python code for FreeCAD macros |
| Model architecture | GPT-4 Turbo / GPT-3.5 in zero-shot setting + BLIP2 feedback loop |
| Dataset | Custom evaluation dataset; no training (prompting only) |
| Geometric metrics | First-attempt success rate (53.6% GPT-4T); +23.1% after refinement |
| RL/reward | Self-refinement via BLIP2 image description → text feedback loop |

**Relevance to voxel:** Demonstrates that iterative refinement with visual feedback helps. For voxels, a similar loop (render voxel grid → VLM describes errors → regenerate) could be applied at inference time.

---

### 9. LLM4CAD (ASME IDETC 2024)
**arXiv:** Published in J. Computing and Information Science in Engineering 2025

| Attribute | Detail |
|---|---|
| Output representation | CAD operations (FreeCAD API); evaluates GPT-4 and GPT-4V |
| Model architecture | GPT-4 / GPT-4V zero-shot; no fine-tuning |
| Dataset | Custom synthetic dataset of mechanical components (gears, springs); labeled via Amazon Mechanical Turk |
| Geometric metrics | Task completion; dimensional accuracy |

**Relevance to voxel:** Low — this is a prompting study for industrial CAD. The finding that GPT-4V with text-only input beats multimodal input is interesting but not directly applicable.

---

### 10. CAD-LLM (NeurIPS 2023 Workshop, Autodesk)
**Task:** CAD sketch autocompletion (not text-to-full-3D)

| Attribute | Detail |
|---|---|
| Output representation | 2D parametric sketch sequences (lines, arcs, circles with constraints) |
| Model architecture | T5-770M; full fine-tuning on sketch sequences tokenized as coordinate parameters |
| Dataset | Proprietary Autodesk sketch dataset |
| Geometric metrics | Sketch completion accuracy |

**Relevance to voxel:** The T5 encoder-decoder architecture and the tokenization of geometric primitives as structured token sequences is directly relevant. T5 ~770M is in your target size range. Shows that encoder-decoder can work for 3D geometry generation.

---

### 11. CadVLM (ECCV 2024, Autodesk)
**arXiv:** 2409.17457

| Attribute | Detail |
|---|---|
| Output representation | 2D parametric sketch sequences + sketch images |
| Model architecture | Asymmetric encoder-decoder: ViT-MAE (vision) + CodeT5+ 770M (text/sequence); total 854M params |
| Dataset | SketchGraphs: 626K training sketches; lines, arcs, circles + 13 constraint types |
| Geometric metrics | Sketch Accuracy, Entity Accuracy, CAD F1 |

**Relevance to voxel:** The dual-encoder (image + sequence) architecture is interesting if you want to condition on 3D renders or orthographic views in addition to text. The contrastive + language modeling + image reconstruction joint loss is a template for multi-task training.

---

### 12. CAD-GPT (arXiv 2412.19663)
**arXiv:** 2412.19663

| Attribute | Detail |
|---|---|
| Output representation | DeepCAD command sequences |
| Model architecture | LLaVA-1.5 7B (ViT-L + Vicuna/LLaMA-2) fine-tuned; custom spatial tokens |
| Dataset | DeepCAD 178K models; 162K image samples + 18K text samples |
| Geometric metrics | Chamfer Distance, Invalidity Ratio |

**Architecture detail — spatial tokenization (directly relevant):**
- **Orientation tokens:** 729 discrete tokens (9×9×9 grid of Euler angles θ,γ,φ)  
- **Position tokens:** 46,656 tokens (36×36×36 grid, K=36 over normalized 1×1×1 cube, ordered z→y→x)  
- **Sketch tokens:** 128 quantization levels per axis

This is essentially a learned voxelization of the CAD operation space. The z→y→x ordering choice is worth noting.

**Relevance to voxel:** The spatial discretization scheme is a direct prototype for how to encode position tokens in a voxel sequence. The 36³ grid at 46K tokens is too large for a voxel grid (at 32³ = 32,768 positions, comparable), but shows that learned position embeddings for 3D spatial coordinates are viable.

---

## Non-CAD Direct Voxel Generation Works

These papers are not text-to-CAD but are directly relevant to the voxel generation architecture question.

### ShapeGPT (arXiv 2311.17618)

| Attribute | Detail |
|---|---|
| Output representation | Voxel grid via SDF VQ-VAE tokens (discrete, 512 tokens per shape) |
| Model architecture | 3D VQ-VAE (64³ input → 8³ latent → 512 tokens); T5-base 220M for sequence generation |
| Dataset | ShapeNet 16 categories (~50K models); Objaverse |
| Geometric metrics | IoU, Chamfer Distance, F-score@1%, ULIP perceptual |
| Text conditioning | Text instructions in T5 input; codebook IDs as `<shape_id_N>` special tokens |

**Architecture detail — voxel tokenization:**
- Input: 64×64×64 SDF voxels
- 3D VQ-VAE with 3× downsampling → 8×8×8 latent grid
- Codebook: 8192 entries × 64 dimensions
- Flattened to 512 tokens using x→y→z axis order
- Each codebook index wrapped as `<shape_id_N>` for T5 input

**This is the most direct antecedent for the proposed system.** T5-base (220M) for the sequence model is in your parameter budget. The 8³ compressed latent grid means each "token" represents an 8×8×8 block of the original 64³ space — much coarser than per-voxel. For 32³ PoC, you could go per-voxel (32,768 tokens) or use a 2× downsampled 16³ latent (4,096 tokens).

---

### CLIP-Sculptor (arXiv 2211.01427)

| Attribute | Detail |
|---|---|
| Output representation | Voxel grids at 32³ and 64³ resolution |
| Model architecture | Two VQ-VAE models (low/high res) + coarse transformer + fine transformer; CLIP conditioning |
| Dataset | ShapeNet13 (13 categories) and ShapeNet55 (55 categories) |
| Text conditioning | CLIP text encoder → conditions coarse transformer; classifier-free guidance |

**Three-stage pipeline:**
1. Train VQ-VAE at 32³ and 64³
2. Train coarse transformer on 32³ VQ-VAE latents conditioned on CLIP embedding
3. Train fine transformer for super-resolution: coarse → 64³ latents

**Relevance to voxel:** A direct PoC architecture. Stage 1 (VQ-VAE) compresses voxels to a manageable sequence. Stage 2 (conditioned transformer) generates coarse structure. Stage 3 (super-resolution transformer) adds detail. This 3-stage approach maps well to a 16³ → 32³ resolution progression.

---

### VoxelCNN / 3D-Craft (ICCV 2019, Facebook Research)

| Attribute | Detail |
|---|---|
| Output representation | Minecraft block sequences (next-block prediction) |
| Model architecture | 3D convolutional network; multi-resolution spatial context encoding |
| Dataset | 3D-Craft: 2,500 Minecraft houses with sequential build orders; **public** |
| Block vocabulary | ~50+ Minecraft block types |
| Text conditioning | None — pure unconditional or completion |

**Critical insight on ordering:** VoxelCNN learns generation order from *human build sequences* rather than arbitrary raster scan. Humans tend to build floor first, then walls, then roof — this imposes a structural prior that makes generation coherent. For text-to-voxel, learning the generation order from data (rather than using fixed Morton/raster order) could be important for coherence.

---

### Scaffold Diffusion (NeurIPS SPIGM 2025)
**arXiv:** 2509.00062

| Attribute | Detail |
|---|---|
| Output representation | Sparse multi-category Minecraft voxels |
| Model architecture | Diffusion Transformer (DiT): 12 blocks, 12 heads, L=1024 token sequence; 3D sinusoidal positional embeddings |
| Dataset | 3D-Craft (filtered to ≤1024 occupied blocks in 32³ bounding box): 1,432 structures |
| Block vocabulary | 253 Minecraft block types |
| Text conditioning | None — uses occupancy map conditioning |
| Geometric metrics | NLL, perplexity; qualitative visual assessment |

**Key technical details:**
- Extracts only *occupied* voxels (avg ~500 out of 32,768 in 32³ cube)
- 98.3% sparsity — air blocks never appear as tokens
- Occupancy map (boolean) provided as conditioning signal
- 3D sinusoidal embeddings: NLL=0.58 vs. learned embeddings NLL=3.37 — huge gap
- MDLM (masked discrete diffusion): forward process corrupts to [MASK] token

**This is the closest existing work to the PoC target.** Differences: (a) it's diffusion not autoregressive, (b) no text conditioning, (c) only 1,432 training examples (very small). **Directly actionable:** use 3D sinusoidal embeddings, not learned positional embeddings. Handle sparsity by only tokenizing occupied voxels.

---

## Comparison Table

| Paper | Output Repr | Architecture | Params | Dataset Size | Text Cond? | Geometric Reward | Year |
|---|---|---|---|---|---|---|---|
| DeepCAD | CAD commands | Transformer autoencoder | ~10M | 178K | No | No | 2021 |
| Text2CAD | CAD commands | BERT+8L decoder | ~100M | 660K | Yes (BERT) | No | 2024 |
| Text-to-CadQuery | Python code | Decoder LLM | 124M–7B | 170K | Yes (LLM) | No (SFT only) | 2025 |
| CAD-Coder | Python code + CoT | Qwen2.5-7B | 7B | 110K | Yes (LLM) | **Yes (CD via GRPO)** | 2025 |
| ReCAD | Python code | Qwen2.5-VL-7B | 7B | 90K | Yes (VLM) | **Yes (IoU + DINOv2)** | 2024 |
| STEP-LLM | STEP files | Llama/Qwen 3B + LoRA | 3B | 40K | Yes (LLM) | **Yes (SCD via GRPO)** | 2026 |
| ToolCAD | Tool calls | Qwen2.5-7B / GPT-4o | 7B+ | 782 trajs | Yes (LLM) | Yes (execution) | 2025 |
| Query2CAD | FreeCAD macros | GPT-4T (zero-shot) | ~175B | Custom | Yes | No (BLIP2 loop) | 2024 |
| CAD-LLM | 2D sketches | T5-770M | 770M | Proprietary | No | No | 2023 |
| CadVLM | 2D sketches | ViT+CodeT5+ | 854M | 626K | Yes (VLM) | No | 2024 |
| CAD-GPT | CAD commands | LLaVA-1.5 7B | 7B | 180K | Yes (VLM) | No | 2024 |
| ShapeGPT | Voxel VQ tokens | 3D VQVAE + T5-220M | 220M | ~50K | **Yes** | No | 2023 |
| CLIP-Sculptor | Voxels 32³/64³ | 2×VQVAE + 2× Transformer | ~100M | ShapeNet | **Yes (CLIP)** | No | 2022 |
| VoxelCNN | Minecraft blocks | 3D ConvNet | ~50M | 2,500 houses | No | No | 2019 |
| Scaffold Diffusion | Minecraft voxels | DiT 12L | ~50M | 1,432 structures | No (occupancy) | No | 2025 |

---

## Failure Modes of the LLM → Code → Execute Paradigm

Understanding why code generation fails is essential to motivating direct voxel generation.

### 1. API Hallucination (Hard Failure)
LLMs confidently generate syntactically plausible but non-existent CadQuery methods (e.g., `Workplane.scale()`, `combine(mode='intersect')`). The code fails at execution — no geometry is produced, no gradient flows. In CAD-Coder's RL phase, this caused training collapse when invalid rates spiked.

**Voxel advantage:** No API surface. The vocabulary is a fixed set of block IDs plus positional indices. Hallucination is impossible — invalid tokens simply violate vocabulary bounds, catchable with argmax/top-k decoding.

### 2. Spatial Reasoning Breakdown (Soft Failure)
LLMs trained on text struggle to maintain 3D coordinate consistency across a multi-step code generation sequence. Common errors: overlapping solids, parts that don't attach at the right location, extruded faces that point the wrong direction. CAD-GPT explicitly notes: "a car with four horizontally placed wheels," "a table with legs that exceed the tabletop." Failure rate 30–50% in early systems.

**Voxel advantage:** Spatial relationships are implicit in the coordinate system. The model never needs to explicitly reason about "extrude this face in the +Z direction by 5mm relative to the current workplane." Each token position *is* a spatial location. Structural relationships emerge from learned statistics.

### 3. Execution Bottleneck (Latency)
Geometric reward computation requires: generate code → execute CadQuery/FreeCAD → convert to mesh → sample point cloud → compute CD. This pipeline adds seconds per sample during RL training. CAD-Coder ran GRPO for 146 hours on 8 A800 GPUs for 1 epoch.

**Voxel advantage:** IoU between two binary voxel grids is a single XOR + count operation. No execution, no point cloud sampling. Reward computation is O(N) in grid size — milliseconds. This makes RL training feasible on a single 3090.

### 4. Representation Mismatch for Voxel-Native Domains
CadQuery targets mechanical B-rep geometry (smooth surfaces, precise dimensions). Organic shapes, terrain, and Minecraft structures are poorly served — you cannot express "stone wall with irregular surface" as a parametric CAD sequence.

**Voxel advantage:** Native representation for Minecraft and any discrete spatial domain. No representation mismatch.

### 5. Distribution Shift and Generalization
Models fine-tuned on DeepCAD's mechanical parts show poor generalization to organic or architectural forms outside the training distribution. The command vocabulary is inherently limited to sketch-and-extrude operations.

**Voxel advantage:** The block vocabulary is domain-complete (by definition) for any target voxel domain.

### 6. Underspecification Cascades
Ambiguous text prompts ("a medium-sized tower") lead models to hallucinate dimensions. Errors in dimension choice compound through subsequent operations. ProCAD addresses this by adding a clarification agent before code generation.

**Voxel advantage:** Underspecified prompts produce structurally coherent but semantically approximate outputs rather than execution failures. The model interpolates from training data rather than crashing.

---

## What to Steal from Text-to-CAD for a Voxel Pipeline

### 1. SFT + GRPO with Geometric Reward (from CAD-Coder / ReCAD / STEP-LLM)

The three-component reward structure:
```
R_total = λ_geo · R_IoU + λ_struct · R_structure + λ_format · R_format

R_IoU = piecewise linear on voxel IoU(pred, target):
  IoU > 0.9 → 1.0
  IoU < 0.1 → 0.0
  else → linear

R_structure = 1.0 if output has ≥ 1 non-air block, else 0.0

R_format = 1.0 if sequence terminated with EOS token, else 0.0
```

GRPO generates K=8 candidate sequences per prompt, normalizes rewards within the group as advantages. This avoids needing a separate critic/value network.

**Critical anti-collapse strategy (from CAD-Coder):** Before GRPO, run SFT on high-quality samples until the invalidity rate is below ~10%. Only then switch on RL. For voxels, "validity" = at least 1 non-air block with reasonable bounding box.

### 2. Dataset Auto-Annotation Pipeline (from Text2CAD / CAD-Coder)

The pipeline:
1. Source: DeepCAD 178K models + Objaverse/ShapeNet meshes
2. Render multi-view images
3. Feed to VLM (GPT-4o / Gemini) with structured captioning prompt
4. Generate 4 complexity levels per shape (abstract → detailed)
5. Filter by geometric similarity score

For Minecraft: use Planet Minecraft or 3D-Craft builds as the source. Auto-caption with "This is a [structure type] made of [primary materials]. It has [height] blocks, [features]..." prompted from multi-view renders.

### 3. Hierarchical Curriculum Learning (from ReCAD)

Start with simple shapes (single material, cubic form) before complex multi-material structures. This is especially important for voxel generation where the model needs to learn the coordinate → material mapping before learning compositional structures.

### 4. 3D Sinusoidal Positional Embeddings (from Scaffold Diffusion)

3D sinusoidal PE: NLL 0.58 vs. learned PE: NLL 3.37 on Minecraft voxels. This is a large gap. Use sinusoidal encoding of (x, y, z) coordinates separately, concatenated or summed, rather than a flat learned embedding of token index.

### 5. Sparsity Handling: Sparse Tokenization

Scaffold Diffusion's key insight: only tokenize occupied voxels (air = background). For a 32³ grid with typical structure occupancy of ~5-15%, this reduces sequence length from 32,768 to ~1,600–4,900 tokens — manageable for a transformer with quadratic attention, or easily linearized with Flash Attention.

Encoding: `[block_id (5 bits for 32 types), x (5 bits), y (5 bits), z (5 bits)] = 20 bits per token`. Or encode as separate token types in the vocabulary.

### 6. Chain-of-Thought Cold Start (from CAD-Coder)

Even for non-LLM models, a curriculum where the model first generates a coarse sketch token (e.g., "this is a tower → tall thin structure → specific blocks") before generating the full sequence could help. This is analogous to the CoT cold-start that prevented CAD-Coder's RL collapse.

---

## Training Data Resources for Text-to-Voxel

| Dataset | Shapes | Text | Format | License | Notes |
|---|---|---|---|---|---|
| Text2Shape | 15K chairs/tables | 75K descriptions | Voxel grids + text | Public | ShapeNet subset; limited categories |
| Cap3D | 1M+ | 1M captions | Point clouds + rendered images | ODC-By | Objaverse/XL; voxelization needed |
| ShapeGPT (ShapeNet) | ~50K | Auto-tagged | SDF voxels 64³ | ShapeNet ToS | Limited text quality |
| 3D-Craft | 2,500 Minecraft houses | None | Voxel sequences 32³ | Public (FB) | No text; captioning needed |
| DeepCAD | 178K | 660K (via Text2CAD) | CAD commands | Public | Not voxel; conversion needed |
| Objaverse | 800K | Via Cap3D | Various; voxelizable | CC-BY | Best option for scale |
| Planet Minecraft | Unknown | Build names/descriptions | Schematic/voxel | Community | Domain-specific; scraping needed |

**Recommended data strategy for PoC:**
1. **Primary:** 3D-Craft + Planet Minecraft schematics → convert to 32³ voxel grids → auto-caption with GPT-4o
2. **Augment:** Text2Shape (already voxel format) for broader shape categories
3. **Scale-up:** Objaverse subset (architecture/objects) → voxelize → Cap3D captions

---

## Open Questions the Literature Doesn't Answer

These are the actual research questions for your PoC:

1. **Tokenization ordering for coherence:** Nobody has done a controlled ablation of XYZ-raster vs. Morton/Z-curve vs. learned human-build ordering for text-conditioned voxel generation. Scaffold Diffusion uses flat sequence (no explicit ordering comparison). The VoxelCNN result suggests human ordering matters for unconditional generation — unclear if this holds with text conditioning.

2. **Compressed latent vs. per-voxel tokens:** ShapeGPT uses 8× compression (64³ → 8³ = 512 tokens). CLIP-Sculptor uses VQ-VAE compression. Scaffold Diffusion uses per-occupied-voxel tokens (no compression). For 32³ at ~5% occupancy = ~1,600 tokens, per-voxel is tractable. At 10-15% occupancy = 3,200–4,900 tokens, still tractable. At full dense 32³ = 32K tokens, compression is necessary.

3. **RL reward design for voxels:** No paper applies GRPO/geometric reward directly to a discrete voxel token sequence. The closest is Scaffold Diffusion (diffusion, no RL) and ShapeGPT (autoregressive, no RL). The combination is the actual research contribution of your PoC.

4. **Boundary condition enforcement:** None of the text-to-CAD papers address voxel-domain-specific constraints (gravity, floor-attachment, enclosed structures). This is domain knowledge that could be injected as reward signal during RL.

---

## Architectural Recommendation for PoC

Based on this survey, the following architecture is most grounded in prior work:

**Stage 1 — Voxel VQ-VAE (optional for 32³, recommended for 64³+):**
- Input: 32³ binary or categorical voxel grid
- Architecture: 3D Conv encoder (4 downsample blocks) → 4³ or 8³ latent
- Codebook: 1024–4096 entries × 256 dims
- Decoder: 3D ConvTranspose
- Prior work: ShapeGPT (64³→8³), CLIP-Sculptor (32³ VQ-VAE)

**Stage 2 — Text-conditioned sequence model:**
- Architecture: GPT-style decoder-only transformer OR T5-style encoder-decoder
- Text encoder: CLIP or T5-small (frozen or lightly fine-tuned)
- Sequence: sparse occupied voxels as `[block_id, x, y, z]` tokens with 3D sinusoidal PE
- Size: 50–100M parameters (8–12 layers, d=512–768, 8–12 heads)
- Generation: autoregressive, left-to-right in Morton/Z-curve order

**Stage 3 — SFT + GRPO:**
- SFT: cross-entropy on ground-truth voxel sequences
- Cold-start: filter to high-quality samples, establish <10% invalidity before GRPO
- GRPO: K=8 candidates, reward = λ_IoU·R_IoU + λ_struct·R_structure + λ_fmt·R_EOS
- Compute budget: IoU on 32³ grids is microseconds; full GRPO loop feasible on single RTX 3090

**Why this beats the code generation approach for your use case:**
- No execution overhead (no CadQuery runtime needed)
- Reward is O(N) not O(mesh sampling)
- No API hallucination failure mode
- Native to Minecraft domain
- Single model, no separate execution environment

---

## Key References

- [DeepCAD (ICCV 2021)](https://arxiv.org/abs/2105.09492) — foundational dataset and command-sequence tokenization
- [Text2CAD (NeurIPS 2024)](https://arxiv.org/abs/2409.17106) — best text-conditioned non-LLM CAD model; BERT+decoder template
- [Text-to-CadQuery (arXiv 2505.06507)](https://arxiv.org/abs/2505.06507) — LLM SFT comparison across model sizes
- [CAD-Coder (NeurIPS 2025)](https://arxiv.org/abs/2505.19713) — SFT+GRPO with geometric CD reward; training pipeline to steal
- [ReCAD (arXiv 2512.06328)](https://arxiv.org/abs/2512.06328) — IoU reward + curriculum; reward formulation reference
- [STEP-LLM (DATE 2026)](https://arxiv.org/abs/2601.12641) — scaled CD reward; DFS serialization insight
- [ToolCAD (arXiv 2604.07960)](https://arxiv.org/abs/2604.07960) — step-level execution reward
- [CAD-GPT (arXiv 2412.19663)](https://arxiv.org/abs/2412.19663) — spatial tokenization scheme (orientation/position tokens)
- [ShapeGPT (arXiv 2311.17618)](https://arxiv.org/abs/2311.17618) — **closest prior work**: VQ-VAE + T5 for voxel token sequences
- [CLIP-Sculptor (arXiv 2211.01427)](https://arxiv.org/abs/2211.01427) — CLIP-conditioned 2-stage VQ-VAE + coarse/fine transformers for voxels
- [VoxelCNN / 3D-Craft (ICCV 2019)](https://arxiv.org/abs/1906.03299) — Minecraft voxel generation; human ordering insight; public dataset
- [Scaffold Diffusion (arXiv 2509.00062)](https://arxiv.org/abs/2509.00062) — **most relevant Minecraft work**: DiT on sparse voxels; 3D sinusoidal PE finding
- [DreamCraft (arXiv 2404.15538)](https://arxiv.org/abs/2404.15538) — text-guided Minecraft generation via NeRF quantization; domain-specific results
- [Text2Shape (arXiv 1803.08495)](http://text2shape.stanford.edu/) — original text-voxel dataset; ShapeNet chairs/tables
- [Cap3D (NeurIPS 2023)](https://cap3d-um.github.io/) — 1M+ captioned 3D objects from Objaverse; best captioning dataset
- [Large LLMs for CAD Survey (arXiv 2505.08137)](https://arxiv.org/html/2505.08137v1) — comprehensive taxonomy of methods
