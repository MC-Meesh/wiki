# Text-to-Voxel PoC: Research Survey

**Project**: Direct text-conditioned 3D voxel generation (autoregressive transformer)
**Hardware target**: Single RTX 3090 (24GB VRAM)
**Scale**: 16^3 to 32^3 voxels, ~20-30 block types (Minecraft testbed)

---

## Subagent Task 1B: Direct 3D Generation Survey

_Surveyed April 2026. Covers transformer/autoregressive approaches primarily; diffusion noted where relevant._

---

## 1. Model-by-Model Analysis

### 1.1 ShapeFormer (CVPR 2022) — CLOSEST PRIOR ART

**Paper**: "ShapeFormer: Transformer-based Shape Completion via Sparse Representation"
**Links**: [Project](https://shapeformer.github.io/) | [PDF](https://shapeformer.github.io/static/ShapeFormer.pdf) | [VCC page](https://vcc.tech/research/2022/ShapeFormer)

| Attribute | Details |
|---|---|
| Representation | Sparse voxels via VQDIF (Vector Quantized Deep Implicit Function) |
| Generative mechanism | Autoregressive transformer over discrete sparse sequences |
| Text conditioning | None — conditioned on partial point cloud only |
| Resolution | Operates on sparse occupancy grid; implicit function captures fine detail |
| Open source | Project page available; code not widely deployed |
| 3090 feasibility | Likely feasible for fine-tuning; original task is shape completion not generation |

**Technical depth:**

ShapeFormer introduces VQDIF, a representation that encodes a 3D shape as a short sequence of discrete 2-tuples `(coordinate, codebook_index)`. Only the occupied/surface-adjacent voxels are retained (exploiting sparsity), so the sequence length stays tractable — a key practical contribution. The VQDIF encoder converts a partial point cloud into this sparse feature sequence, replacing each local feature with its nearest-neighbor codebook index.

The transformer is then trained to model the conditional distribution `p(S_complete | S_partial)` autoregressively, sampling token by token. This is genuinely autoregressive discrete sequence generation over a voxel-like representation.

**Sequence ordering**: The paper uses a fixed spatial scan order over occupied voxels (positions encoded in the 2-tuple), but the ordering problem is partially sidestepped because only surface-adjacent voxels are in the sequence. Spatial locality is preserved via positional encoding of the voxel coordinates in the discrete token itself.

**Limitations for this project:**
1. No text conditioning — it is a completion model, not a generation model from scratch
2. VQDIF encodes an implicit function, not raw block-type categories. The output is a continuous SDF decoded from discrete latent codes, not a hard voxel grid of block types
3. Relies on partial point cloud as conditioning signal — no language grounding
4. Resolution of the implicit grid is determined by VQDIF resolution; unclear direct mapping to discrete block grids

---

### 1.2 AutoSDF (CVPR 2022)

**Paper**: "AutoSDF: Shape Priors for 3D Completion, Reconstruction and Generation"
**Links**: [Project](https://yccyenchicheng.github.io/AutoSDF/) | [arXiv](https://arxiv.org/abs/2203.09516)

| Attribute | Details |
|---|---|
| Representation | Discrete latent grid over SDF (VQ-VAE compressed) |
| Generative mechanism | Non-sequential autoregressive transformer (randomized order during training) |
| Text conditioning | Language-guided generation via naive conditional (CLIP or similar) |
| Resolution | VQ-VAE operates at low-res symbolic grid; coarse |
| Open source | Project page + code available |
| 3090 feasibility | Yes — VQ-VAE + small transformer is lightweight |

**Technical depth:**

AutoSDF's core insight: train the transformer with a *randomized* sampling order during training, which allows any subset of tokens to condition on any other subset at inference. This makes it a non-sequential autoregressive model — it can fill in missing tokens conditioned on observed ones from arbitrary positions (like BERT meets autoregressive).

The VQ-VAE compresses local SDF patches into discrete codes arranged in a coarse grid. The transformer operates over this grid. For language-guided generation, they use a "naive conditional" — the CLIP text embedding is appended as additional conditioning but is not deeply integrated.

**Limitations for this project:**
1. Output is an SDF, not discrete voxel categories. Conversion to hard voxels requires thresholding and loses multi-class information
2. Text conditioning is shallow (added as a naive conditioning signal, not tight cross-attention)
3. Non-sequential generation is elegant but may not capture the causal structure of spatial generation as well as strictly left-to-right autoregression
4. No Minecraft or multi-class block-type output head

---

### 1.3 Point-E (OpenAI, Dec 2022)

**Paper**: "Point-E: A System for Generating 3D Point Clouds from Complex Prompts"
**Links**: [OpenAI blog](https://openai.com/index/point-e/) | [arXiv](https://arxiv.org/abs/2212.08751) | [GitHub](https://github.com/openai/point-e)

| Attribute | Details |
|---|---|
| Representation | Point cloud (1K coarse, 4K fine) |
| Generative mechanism | Diffusion (point cloud diffusion model) |
| Text conditioning | Two-stage: text → image (3B GLIDE fine-tuned on 3D), image → pointcloud |
| Resolution | 1,024 (coarse) → 4,096 (fine) points |
| Open source | Yes, weights on GitHub/HuggingFace |
| 3090 feasibility | Inference yes; full training of 3B stage is not feasible; fine-tuning the PC diffusion stage is possible |

**Technical depth:**

Point-E pivots through an intermediate 2D image to leverage a large text-to-image prior (fine-tuned GLIDE on rendered 3D models). The point cloud diffusion model uses a transformer architecture; images are encoded via ViT-L/14 CLIP and cross-attended into the diffusion transformer. The two-stage approach trades off quality against speed — generation completes in 1-2 minutes on a single GPU.

**Why it doesn't directly apply:**
1. Diffusion, not autoregressive. Output is a continuous point cloud, not discrete block types
2. Point clouds have no natural grid structure, requiring a post-processing voxelization step to get Minecraft blocks. This voxelization loses the semantic labels
3. No block-type prediction — it generates geometry/color, not categorical labels
4. The 3B text-to-image stage is not 3090-trainable from scratch

---

### 1.4 Shap-E (OpenAI, May 2023)

**Paper**: "Shap-E: Generating Conditional 3D Implicit Functions"
**Links**: [arXiv](https://arxiv.org/pdf/2305.02463) | [GitHub](https://github.com/openai/shap-e) | [HuggingFace](https://huggingface.co/openai/shap-e)

| Attribute | Details |
|---|---|
| Representation | Implicit function (MLP parameters) — can render as NeRF or mesh |
| Generative mechanism | Diffusion over MLP weight parameters |
| Text conditioning | CLIP text encoder → conditioned diffusion |
| Resolution | Continuous implicit; render resolution is arbitrary |
| Open source | Yes, weights available |
| 3090 feasibility | Inference yes; full training requires large dataset of 3D+text pairs; fine-tuning feasible |

**Technical depth:**

Shap-E is a two-stage system. Stage 1: a deterministic encoder maps any 3D asset (point cloud + rendered views) into the parameters of a neural implicit function (a small MLP). Stage 2: a conditional diffusion model is trained to generate those MLP parameter vectors conditioned on text or images.

This is an unusual generative target — the model generates weights of a neural network, not explicit geometry. The output is continuous and requires rendering (marching cubes or NeRF volumetric rendering) to get geometry.

**Why it doesn't directly apply:**
1. Diffusion, not autoregressive
2. Output is continuous implicit function parameters — no mapping to discrete block categories
3. No concept of Minecraft block vocabulary
4. Training requires a large proprietary dataset of textured 3D meshes with captions

---

### 1.5 GET3D (NVIDIA, NeurIPS 2022)

**Paper**: "GET3D: A Generative Model of High Quality 3D Textured Shapes Learned from Images"
**Links**: [NVIDIA Research](https://research.nvidia.com/labs/toronto-ai/GET3D/) | [GitHub](https://github.com/nv-tlabs/GET3D)

| Attribute | Details |
|---|---|
| Representation | Explicit triangle mesh via DMTet |
| Generative mechanism | GAN (StyleGAN-based) |
| Text conditioning | CLIP directional loss on rendered 2D images (not native) |
| Resolution | High-resolution mesh output |
| Open source | Yes |
| 3090 feasibility | Training feasible on single GPU |

**Why it doesn't apply:**
GET3D is fundamentally GAN-based and mesh-centric. The core technical reason voxels are avoided: "3D voxel grids have a high memory footprint and computational complexity of 3D convolutions that hinder generation at high resolution." The CLIP-guided text conditioning is applied as a loss on 2D renders, not as semantic conditioning of a 3D prior. No discrete voxel output is produced. This is a generative mesh model, not a voxel language model.

---

### 1.6 Magic3D / DreamFusion

**Papers**: DreamFusion (arXiv 2022) | Magic3D (CVPR 2023)
**Links**: [DreamFusion](https://dreamfusion3d.github.io/) | [Magic3D arXiv](https://arxiv.org/abs/2211.10440)

| Attribute | Details |
|---|---|
| Representation | NeRF (DreamFusion), then refined to mesh (Magic3D) |
| Generative mechanism | Score Distillation Sampling (SDS) — optimization, not sampling |
| Text conditioning | Inherits from a frozen 2D diffusion prior (Imagen/Stable Diffusion) |
| Resolution | Mesh resolution arbitrary; NeRF voxel hash grid coarse |
| Open source | DreamFusion no official code; stable-dreamfusion community impl |
| 3090 feasibility | Inference/optimization yes (slow); not trainable from scratch |

**Why they don't apply:**
These are per-shape optimization methods, not generative models that can be trained and sampled from. There is no learnable prior over 3D shapes — each new text prompt requires a fresh optimization run (hours to minutes per shape). The 3D representation is implicit (NeRF or DMTet), not discrete voxels. Text grounding is entirely mediated through the frozen 2D diffusion prior — no direct 3D structure is learned.

---

### 1.7 Zero123 / One-2-3-45

**Links**: [Zero123](https://zero123.cs.columbia.edu/) | [One-2-3-45](https://one-2-3-45.github.io/)

| Attribute | Details |
|---|---|
| Representation | Multi-view 2D images → 3D lift |
| Generative mechanism | Diffusion (view-conditioned image diffusion) |
| Text conditioning | No — image conditioned; can chain with text-to-image |
| Resolution | 2D multi-view; 3D output depends on reconstruction |
| Open source | Yes |
| 3090 feasibility | Inference yes |

**Why they don't apply:**
These are view synthesis / 3D lifting methods. They take a single image as input and generate novel views, from which 3D can be reconstructed. The 3D representation is entirely mediated through 2D renders. No discrete voxel output, no language grounding, no spatial block vocabulary.

---

### 1.8 XCube (NVIDIA CVPR 2024 Highlight)

**Paper**: "XCube: Large-Scale 3D Generative Modeling using Sparse Voxel Hierarchies"
**Links**: [NVIDIA Research](https://research.nvidia.com/labs/toronto-ai/xcube/) | [GitHub](https://github.com/nv-tlabs/XCube) | [arXiv](https://arxiv.org/abs/2312.03806)

| Attribute | Details |
|---|---|
| Representation | Sparse voxel hierarchies (VDB structure), up to 1024^3 effective resolution |
| Generative mechanism | Latent diffusion (hierarchical, coarse-to-fine) |
| Text conditioning | Supported via CLIP/text embeddings |
| Resolution | Up to 1024^3 sparse; objects and outdoor scenes (100m x 100m) |
| Open source | Yes, CVPR 2024 |
| 3090 feasibility | Very unlikely — designed for multi-GPU, large-scale training |

**Technical notes:**
XCube is the state-of-art in sparse voxel diffusion. Uses a custom framework built on VDB (volumetric data grids). Generates the sparse *structure* first, then fills in latent features. The hierarchical diffusion allows tractable generation at extreme resolutions. However, it is a continuous latent diffusion model — no discrete voxel block categories, and scale/compute requirements far exceed a 3090.

---

### 1.9 SAR3D (CVPR 2025)

**Paper**: "SAR3D: Autoregressive 3D Object Generation and Understanding via Multi-scale 3D VQVAE"
**Links**: [Project](https://cyw-3d.github.io/projects/SAR3D/) | [arXiv](https://arxiv.org/abs/2411.16856) | [GitHub](https://github.com/cyw-3d/SAR3D)

| Attribute | Details |
|---|---|
| Representation | Triplane latent (multi-scale VQ-VAE over triplane) |
| Generative mechanism | Autoregressive (next-scale prediction) |
| Text conditioning | CLIP-T ViT-L text encoder; cross-attention injection; CFG with 10% dropout |
| Resolution | Codebook V=16,384; dimension C=8; 10 scales (1^2 to 16^2 triplane resolution) |
| Open source | Yes |
| 3090 feasibility | No — trained on 7x A100 (80GB each). Multi-view encoder is the bottleneck |

**Technical depth:**

SAR3D is the closest recent work to a text-conditioned autoregressive 3D model with principled VQ-VAE tokenization. Key design: instead of predicting the next single token, it predicts the next *scale* of tokens (all tokens at a given triplane resolution in parallel). This dramatically speeds generation (0.82s on A6000) while maintaining autoregressive conditioning.

The VQ-VAE operates on triplane features derived from 6 multi-view RGBD renders (256x256, 10-channel input). The shared codebook across all scales is L2-normalized for training stability. Text embeddings injected via cross-attention in the decoder-only autoregressive transformer.

**Limitations for this project:**
1. Multi-view RGBD input encoder requires rendering 3D assets — not trainable from a voxel grid directly
2. Triplane is a continuous implicit representation, not discrete block categories
3. Compute requirements (7x A100) are prohibitive for 3090

---

### 1.10 OctGPT (SIGGRAPH 2025)

**Paper**: "OctGPT: Octree-based Multiscale Autoregressive Models for 3D Shape Generation"
**Links**: [arXiv](https://arxiv.org/abs/2504.09975) | [GitHub](https://github.com/octree-nn/octgpt)

| Attribute | Details |
|---|---|
| Representation | Octree + VQ-VAE binary tokens for fine detail |
| Generative mechanism | Multiscale autoregressive transformer |
| Text conditioning | Yes — text, sketch, and image conditioning |
| Resolution | Up to 1024^3 effective; trained on 4x RTX 4090 |
| Open source | Yes |
| 3090 feasibility | Possibly — 4x 4090 is comparable to ~2x 3090 in total VRAM; single 3090 would require batch size reduction |

**Technical depth:**

OctGPT serializes the octree using depth-first traversal order, which preserves spatial hierarchy. Binary tokens from VQ-VAE capture fine-grained surface detail. The multiscale approach dramatically reduces sequence length — 13x speedup in training, 69x in generation vs. prior octree approaches. Text conditioning is first-class.

This is one of the most relevant and practical recent works. However, it operates on continuous shape geometry (surface meshes/SDFs) — not discrete multi-class block categories.

---

### 1.11 3D-WAG (BMVC 2025)

**Paper**: "3D-WAG: Hierarchical Wavelet-Guided Autoregressive Generation for High-Fidelity 3D Shapes"
**Links**: [arXiv](https://arxiv.org/abs/2411.19037)

| Attribute | Details |
|---|---|
| Representation | Wavelet domain implicit distance fields (multi-scale) |
| Generative mechanism | Autoregressive next-scale prediction (GPT-2 style) |
| Text conditioning | Yes (class-conditioned and text-conditioned modes) |
| Resolution | High-fidelity 3D implicit; 1.15s per sample |
| Open source | BMVC 2025 |
| 3090 feasibility | Likely yes — inference speed and BMVC venue suggest moderate compute |

**Technical depth:**

3D-WAG encodes 3D implicit distance fields in the wavelet domain across multiple scales, then trains a GPT-2-like autoregressive model for next-scale prediction. This avoids the exponential sequence length of flat voxel tokenization by operating on wavelet coefficients that naturally capture coarse-to-fine structure.

**Limitation:** Again operates on continuous implicit functions, not discrete multi-class voxels.

---

### 1.12 G3PT (IJCAI 2025)

**Paper**: "G3PT: Unleash the Power of Autoregressive Modeling in 3D Generation via Cross-scale Querying Transformer"
**Links**: [arXiv](https://arxiv.org/abs/2409.06322) | [IJCAI](https://www.ijcai.org/proceedings/2025/262)

| Attribute | Details |
|---|---|
| Representation | Point cloud (16,384 points) → multi-scale discrete tokens |
| Generative mechanism | Cross-scale autoregressive (next-scale, not next-token) |
| Text conditioning | CLIP — basic attempt; cross-attention injection |
| Resolution | Up to 1.5B parameter model; trained 2 weeks on 136x H20 GPUs |
| Open source | Paper released; code TBD |
| 3090 feasibility | 0.1B variant may be feasible; full scale is not |

**Key architectural insight:** The Cross-scale Querying Transformer (CQT) avoids imposing any spatial order on tokens by using cross-attention between scales rather than self-attention in a flat sequence. This solves the ordering problem in an order-free way.

---

### 1.13 Scaffold Diffusion (NeurIPS SPIGM 2025) — DIRECTLY RELEVANT

**Paper**: "Scaffold Diffusion: Sparse Multi-Category Voxel Structure Generation with Discrete Diffusion"
**Links**: [arXiv](https://arxiv.org/abs/2509.00062) | [GitHub](https://github.com/jsjung00/scaffold-diffusion) | [Project](https://scaffold.deepexploration.org/)

| Attribute | Details |
|---|---|
| Representation | Discrete multi-category voxels (Minecraft block IDs) |
| Generative mechanism | Discrete diffusion (Masked Diffusion Language Model) |
| Text conditioning | None — structure-only generation |
| Resolution | 32^3 primary; 64^3 also tested |
| Block vocabulary | 253 block IDs (from 3D-Craft Minecraft dataset) |
| Open source | Yes |
| 3090 feasibility | Yes — DiT backbone with 12 blocks/heads is moderate scale |

**Technical depth — most directly relevant to this project:**

Scaffold Diffusion is the paper that most closely demonstrates the feasibility and challenges of the exact problem this project tackles. Key findings:

1. **Dataset**: 3D-Craft dataset (Minecraft houses), 32^3 and 64^3 voxel cubes, 253 block categories
2. **Sequence representation**: Flat voxel grid with 3D sinusoidal positional embeddings, sequence length L=1024 at 32^3 (post-sparsification)
3. **Autoregressive baseline**: The authors built a next-token prediction autoregressive baseline with the *same DiT backbone*. Result: "the autoregressive approach typically generates collapsed structures that contain only a few different block category types." This is a critical finding — naive autoregressive prediction fails hard on multi-class sparse voxel grids
4. **Why diffusion wins here**: The discrete diffusion (MDLM) approach handles class imbalance and sparsity (98%+ air blocks) better because it can denoise globally rather than predicting token-by-token
5. **No text conditioning** — purely structural generation from scratch or conditioned on occupancy map

**Key takeaway for this project**: The autoregressive collapse finding from Scaffold Diffusion is the central challenge. When training an autoregressive model on Minecraft-style voxels with 98% air and 2% structured blocks, the model collapses to predicting the dominant class. This is the specific problem that must be addressed with:
- Better loss weighting / focal loss on rare block types
- Sparse-only training (only predict non-air tokens)
- VQ-VAE compression first (so each token represents a spatial patch, not a single voxel)
- Hierarchical / coarse-to-fine generation

---

### 1.14 PolyGen (DeepMind, ICML 2020) — Historical Reference

**Paper**: "PolyGen: An Autoregressive Generative Model of 3D Meshes"
**Links**: [arXiv](https://arxiv.org/abs/2002.10880) | [GitHub](https://github.com/google-deepmind/deepmind-research/tree/master/polygen)

| Attribute | Details |
|---|---|
| Representation | 3D meshes (vertices + faces as sequences) |
| Generative mechanism | Autoregressive transformer (masked decoder) |
| Text conditioning | None natively; conditions on object class, voxels, or images |
| Resolution | Up to ~800 vertex mesh |
| Open source | Yes |
| 3090 feasibility | Yes |

**Relevance**: PolyGen pioneered the idea of serializing 3D structure as a 1D sequence for a transformer. Vertex sequence is ordered by z, y, x axis values. Faces ordered by lowest vertex index. This is the direct precursor to thinking about voxel sequences for transformers. The voxel-conditioned mode of PolyGen (input: voxel grid → output: mesh) shows that cross-modal conditioning from voxels works, though in the wrong direction for this project.

---

### 1.15 ShapeLLM-Omni (NeurIPS 2025 Spotlight)

**Paper**: "ShapeLLM-Omni: A Native Multimodal LLM for 3D Generation and Understanding"
**Links**: [arXiv](https://arxiv.org/abs/2506.01853) | [GitHub](https://github.com/JAMESYJL/ShapeLLM-Omni)

| Attribute | Details |
|---|---|
| Representation | 64^3 voxel → 16^3 latent via 3D VQ-VAE → 1024 discrete tokens |
| Generative mechanism | Autoregressive LLM (Qwen-2.5-VL-7B backbone) |
| Text conditioning | Full text-to-3D via LLM natural language understanding |
| Resolution | 64^3 voxel input; 16^3 latent; 8192-entry codebook; 1024 tokens per object |
| Open source | Yes |
| 3090 feasibility | 7B model requires QLoRA for 3090; base VQVAE training feasible |

**Technical depth — directly relevant to VQ-VAE compression question:**

ShapeLLM-Omni provides a concrete, working example of the VQ-VAE compression path: `64^3 voxel → 16^3 latent → 1024 tokens (codebook size 8192)`. This is a 4x spatial compression per axis (64x total), reducing a 262,144-voxel grid to 1,024 tokens. The codebook is trained via standard VQ-VAE with commitment loss.

The approach extends Qwen-2.5-VL-7B by adding the 8,192 3D token IDs to the vocabulary and training the combined model on a large 3D-text dataset (3D-Alpaca). For a single 3090, QLoRA of the LLM stage is feasible; training the 3D VQ-VAE from scratch is definitely feasible (it is much smaller).

**Limitation for this project**: Uses generic ShapeNet-style 3D meshes → voxels conversion, not Minecraft block categories. The voxel representation is binary occupancy, not multi-class block types. To adapt: the VQ-VAE output head would need to predict probability distributions over block categories rather than a binary occupancy scalar.

---

### 1.16 Octree Transformer (CVPRW 2023)

**Paper**: "Octree Transformer: Autoregressive 3D Shape Generation on Hierarchically Structured Sequences"
**Links**: [arXiv](https://arxiv.org/abs/2111.12480) | [GitHub](https://github.com/GregorKobsik/Octree-Transformer)

| Attribute | Details |
|---|---|
| Representation | Octree (binary occupancy, surface-centric) |
| Generative mechanism | Autoregressive transformer |
| Text conditioning | None |
| Resolution | Arbitrary (up to 128^3 effective) |
| Open source | Yes |
| 3090 feasibility | Yes — workshop paper, moderate scale |

**Sequence ordering**: Breadth-first or depth-first octree traversal. Each node is either empty, filled, or mixed (has children). The key insight: octree traversal provides a natural hierarchical ordering that implicitly encodes spatial context — coarse decisions before fine ones. This is substantially better than flat XYZ raster scan for spatial coherence.

**Limitation**: Binary occupancy only. No block categories, no text conditioning.

---

## 2. Comparison Table

| Model | Repr. | Mechanism | Text? | Resolution | Open Source | 3090 Trainable |
|---|---|---|---|---|---|---|
| ShapeFormer (CVPR 2022) | Sparse voxel implicit (VQDIF) | Autoregressive | No | Implicit/sparse | Partial | Fine-tune yes |
| AutoSDF (CVPR 2022) | VQ-VAE SDF grid | Non-seq. autoregressive | Shallow | Low-res latent | Yes | Yes |
| PolyGen (ICML 2020) | Mesh (vertices+faces) | Autoregressive | Class/voxel | ~800 verts | Yes | Yes |
| Point-E (2022) | Point cloud (4K pts) | Diffusion | Yes (2-stage) | 1K/4K pts | Yes | Partial |
| Shap-E (2023) | Implicit (MLP weights) | Diffusion | Yes | Continuous | Yes | Partial |
| GET3D (2022) | Mesh (DMTet) | GAN | CLIP loss | High-res mesh | Yes | Yes |
| Magic3D/DreamFusion | NeRF/mesh | SDS optimization | Yes | Continuous | Community | N/A (per-shape opt) |
| Zero123/One-2-3-45 | Multi-view 2D | Diffusion | No (image) | 2D renders | Yes | Partial |
| XCube (CVPR 2024) | Sparse voxel (VDB) | Latent diffusion | Yes | Up to 1024^3 | Yes | No |
| SAR3D (CVPR 2025) | Triplane VQ-VAE | Autoregressive (next-scale) | Yes (CLIP-T) | 10-scale triplane | Yes | No |
| OctGPT (SIGGRAPH 2025) | Octree + VQ-VAE | Autoregressive (multiscale) | Yes | Up to 1024^3 | Yes | Borderline |
| 3D-WAG (BMVC 2025) | Wavelet implicit | Autoregressive (next-scale) | Yes | High-fidelity | Yes | Likely |
| G3PT (IJCAI 2025) | Pointcloud multi-scale | Autoregressive (CQT) | Shallow | 0.1B-1.5B | Partial | 0.1B only |
| **Scaffold Diffusion (NeurIPS 2025)** | **Discrete voxels (Minecraft)** | **Discrete diffusion** | **No** | **32^3/64^3, 253 types** | **Yes** | **Yes** |
| **ShapeLLM-Omni (NeurIPS 2025)** | **VQ-VAE → LLM tokens** | **Autoregressive LLM** | **Yes (full NL)** | **64^3→1024 tokens** | **Yes** | **QLoRA yes** |
| Octree Transformer (CVPRW 2023) | Octree binary | Autoregressive | No | Up to 128^3 | Yes | Yes |

---

## 3. The Gap: Autoregressive Discrete Multi-Class Voxel Sequence Generation Conditioned on Text

**Is there prior work on AUTOREGRESSIVE DISCRETE VOXEL SEQUENCE generation conditioned on text?**

The direct answer is: **No complete, working, open-source system exists that does all of the following simultaneously:**
1. Autoregressive (not diffusion, not GAN, not SDS optimization)
2. Discrete voxel grid output with multi-class block categories
3. Text-conditioned
4. 3090-feasible scale

The closest approaches are:
- **ShapeLLM-Omni** does (1)(3)(4) but uses binary occupancy voxels (not multi-class block types) and requires a 7B LLM backbone
- **SAR3D** does (1)(3) but operates on continuous triplane latents, not discrete block categories, and requires A100 scale
- **Scaffold Diffusion** does (2) and (4) on Minecraft data, but is a diffusion model (not autoregressive) and has no text conditioning; critically, it demonstrates that the naive autoregressive baseline **fails on this exact task**

**Summary of the gap:**

The specific combination — autoregressive generation of discrete multi-category voxel grids (Minecraft-style blocks) conditioned on natural language, trained at PoC scale (16^3 to 32^3, ~20-30 block types, RTX 3090) — has not been demonstrated in the literature. The Scaffold Diffusion autoregressive baseline explicitly showed this fails naively, which means solving it requires deliberate architectural choices. That is exactly what this project does.

---

## 4. VQ-VAE Compression for 3D: Feasibility Analysis

### What compression ratios are practical on a 3090?

Based on surveyed work, these concrete numbers apply:

| Input | Latent | Tokens | Compression | Source |
|---|---|---|---|---|
| 64^3 binary voxels | 16^3 | 1,024 | 64x spatial (256x total if float→int) | ShapeLLM-Omni |
| 256^3 SDF | 12^3 × 4 | ~6,912 | 2,427x | TRELLIS paper |
| 32^3 discrete voxels | 8^3 | 512 | 8x spatial | Estimated (linear scale-down) |
| 16^3 discrete voxels | 4^3 | 64 | 8x spatial | Estimated |

**For a 16^3 voxel grid:**
- Naive flat sequence: 16^3 = 4,096 tokens — already manageable for a small transformer
- After 2x spatial compression: 8^3 = 512 tokens — ideal GPT-2 scale
- After 4x spatial compression: 4^3 = 64 tokens — very short, may lose too much spatial detail for block-type fidelity

**For a 32^3 voxel grid:**
- Naive flat sequence: 32^3 = 32,768 tokens — too long for a small transformer
- After 4x spatial compression: 8^3 = 512 tokens — manageable
- After 8x spatial compression: 4^3 = 64 tokens — again, very short

**VQ-VAE training on 3090:**

A 3D VQ-VAE for 32^3 input with:
- Encoder: 3D conv stack (4 down-conv layers, ~4M params)
- Codebook: 512-8192 entries, 64-256 dimensional
- Decoder: 3D deconv stack (~4M params)

Total: ~10-20M params, easily fits in 24GB. Training on ShapeNet-scale data (50K objects) takes hours. Training on Minecraft 3D-Craft (house structures) would take similar time.

**Key design choice for multi-class voxels:**

Standard 3D VQ-VAE is designed for continuous inputs (SDF, color, density). For discrete block categories, the input is a one-hot or embedding lookup per voxel. Two options:
1. **Soft approach**: Embed block categories as dense vectors (e.g., 32-dim embedding per block type), pass the embedded volume through the 3D VQ-VAE. Decoder outputs a distribution over block categories at each output position
2. **Hard approach**: Treat the block-type grid as a multi-channel volume (one channel per block type as a probability/one-hot), then VQ-VAE the full multi-channel volume. This scales poorly with vocabulary size

Option 1 (block embedding → 3D VQ-VAE → autoregressive model → block distribution) is the recommended path and is directly analogous to how ShapeLLM-Omni handles voxel compression, with the addition of a categorical output head.

---

## 5. Sequence Ordering: What the Literature Says

The survey reveals a clear evolution in thinking about 3D sequence ordering:

### Generation 1: Flat XYZ Scan (2020-2022)
- PolyGen: vertices sorted by z, y, x
- AutoSDF: grid-like latent with randomized order
- Simple but long sequences; poor spatial locality for large grids

### Generation 2: Octree / Hierarchical Traversal (2022-2023)
- Octree Transformer: breadth-first or depth-first traversal
- ShapeFormer: sparse occupied-only scan with coordinate in token
- Significantly shorter sequences by focusing on surface/occupied voxels
- Natural coarse-to-fine ordering

### Generation 3: Next-Scale Prediction (2024-2025)
- SAR3D, 3D-WAG, OctGPT, G3PT: all use "next scale" not "next token"
- Generate all tokens at resolution level k in parallel, conditioned on all levels 0..k-1
- Orders-of-magnitude speedup; avoids the ordering problem entirely

### Morton / Z-curve (theoretical interest):
- Morton (Z-curve) encoding interleaves bit representations of x, y, z coordinates, producing a locality-preserving 1D ordering where spatially adjacent voxels are also adjacent or near-adjacent in the sequence
- Preserves spatial locality better than XYZ raster scan (which breaks locality at row/plane boundaries)
- Used in GPU texture memory, voxel octrees, and point cloud processing; not yet standard in 3D generative models
- For a 32^3 grid this gives sequences where adjacent blocks in 3D space are within ~7 positions of each other in the sequence — much better than XYZ scan where plane boundaries break locality

**Recommendation for this project:**

Given the small scale (16^3 to 32^3), the ordering question has a practical hierarchy:
1. **VQ-VAE first** reduces sequence length enough that flat XYZ scan may be fine at 512 tokens
2. **If training directly on raw voxels**, Morton/Z-curve is better than XYZ scan, octree traversal is better than both
3. **Next-scale prediction** is the state-of-art approach and worth implementing if multi-resolution VQ-VAE is used

---

## 6. Training Data: 3D Structure + Text Labels

The survey reveals these options:

| Dataset | 3D Type | Text Labels | Scale | Notes |
|---|---|---|---|---|
| 3D-Craft (Chen 2019) | Minecraft voxels | None | ~5K houses | Used by Scaffold Diffusion; 32^3 chunks; 253 block types |
| ShapeNet | Meshes (categories) | Category labels | 51K models | Standard benchmark; no natural language |
| Objaverse | Meshes | Some captions | 800K+ objects | Used by G3PT, Point-E; uneven quality |
| Objaverse-XL | Meshes | Richer captions | 10M+ | Used for Point-E/Shap-E scale training |
| 3D-Alpaca | Voxels + text | Full NL descriptions | Used by ShapeLLM-Omni | Custom dataset; not released |
| BuildingNet | Architectural meshes | Part labels | 513 buildings | Too small for pre-training |

**For Minecraft specifically:**

The 3D-Craft dataset (human-built Minecraft houses) is the most directly relevant dataset with actual block types. It is small (~5K structures), but enough for a PoC. Auto-captioning is straightforward: a structure of a certain type (house, tower, castle) can be labeled programmatically from world metadata or via a CLIP-based vision captioner applied to rendered views.

The Hugging Face model `CraftGPT/TransformerBlock2Vec` is a 3D RoPE transformer trained on Minecraft schematics with masked language modeling — not generative, but demonstrates the tokenization approach.

---

## 7. Key Architectural Recommendations for This Project

Based on the survey, the recommended architecture for a 3090-feasible text-to-voxel PoC:

### Option A: VQ-VAE + GPT-style Autoregressive (ShapeLLM-Omni path, adapted)
1. **3D VQ-VAE** (trainable on 3090, ~10M params): Encode 32^3 block-type grid → 8^3 latent → 512 tokens from codebook of 512-1024 entries. Multi-class output head (cross-entropy over block vocabulary per decoded voxel position)
2. **GPT-2 style transformer** (~50-100M params): Causal LM over 512-token sequences, text-conditioned via CLIP-text cross-attention. XYZ or Morton-ordered flat sequence at this scale
3. **Text conditioning**: Frozen CLIP ViT-B/32 text encoder (no fine-tuning needed for PoC), cross-attention every other transformer layer

### Option B: Sparse-only Autoregressive (ShapeFormer-inspired)
1. Skip air tokens entirely. Represent the structure as a sequence of `(x, y, z, block_type)` tuples ordered by Morton code
2. At 32^3 with ~2% occupancy, sequence length ≈ 600 tokens — already GPT-friendly without any compression
3. GPT-style transformer with text prefix, predict (coordinate, block_type) pairs autoregressively
4. Challenge: must handle variable-length sequences and define a sensible stopping criterion

### Option C: Discrete Diffusion (Scaffold Diffusion path + text conditioning)
Not autoregressive, but the survey strongly suggests this is more stable than AR for multi-class sparse voxels. Text conditioning can be added via classifier-free guidance on the DiT backbone. This is the pragmatic path if AR quality is poor.

**The key unsolved problem** (as identified by Scaffold Diffusion's AR baseline): naive next-token AR prediction on high-sparsity multi-class voxels collapses. The solution space is:
- Masked prediction (predict only non-air tokens, condition on their positions)
- Loss reweighting (heavy weight on rare block types)
- VQ-VAE compression first (eliminates per-air-voxel prediction entirely)
- Next-scale prediction (avoids long flat sequences)

---

## Sources

- [ShapeFormer Project Page](https://shapeformer.github.io/)
- [ShapeFormer PDF](https://shapeformer.github.io/static/ShapeFormer.pdf)
- [AutoSDF arXiv](https://arxiv.org/abs/2203.09516)
- [AutoSDF Project](https://yccyenchicheng.github.io/AutoSDF/)
- [Point-E arXiv](https://arxiv.org/abs/2212.08751)
- [Point-E GitHub](https://github.com/openai/point-e)
- [Shap-E arXiv](https://arxiv.org/pdf/2305.02463)
- [Shap-E GitHub](https://github.com/openai/shap-e)
- [GET3D NVIDIA Research](https://research.nvidia.com/labs/toronto-ai/GET3D/)
- [XCube arXiv](https://arxiv.org/abs/2312.03806)
- [XCube GitHub](https://github.com/nv-tlabs/XCube)
- [SAR3D arXiv](https://arxiv.org/abs/2411.16856)
- [SAR3D GitHub](https://github.com/cyw-3d/SAR3D)
- [OctGPT arXiv](https://arxiv.org/abs/2504.09975)
- [OctGPT GitHub](https://github.com/octree-nn/octgpt)
- [Octree Transformer arXiv](https://arxiv.org/abs/2111.12480)
- [Octree Transformer GitHub](https://github.com/GregorKobsik/Octree-Transformer)
- [3D-WAG arXiv](https://arxiv.org/abs/2411.19037)
- [G3PT arXiv](https://arxiv.org/abs/2409.06322)
- [PolyGen arXiv](https://arxiv.org/abs/2002.10880)
- [PolyGen GitHub](https://github.com/google-deepmind/deepmind-research/tree/master/polygen)
- [ShapeLLM-Omni arXiv](https://arxiv.org/abs/2506.01853)
- [ShapeLLM-Omni GitHub](https://github.com/JAMESYJL/ShapeLLM-Omni)
- [Scaffold Diffusion arXiv](https://arxiv.org/abs/2509.00062)
- [Scaffold Diffusion GitHub](https://github.com/jsjung00/scaffold-diffusion)
- [Magic3D arXiv](https://arxiv.org/abs/2211.10440)
- [Zero123 Project](https://zero123.cs.columbia.edu/)
- [TRELLIS arXiv](https://arxiv.org/abs/2512.14692)
- [Uni-3DAR arXiv](https://arxiv.org/abs/2503.16278)
- [VAT 512-byte 3D tokenizer arXiv](https://arxiv.org/abs/2412.02202)
