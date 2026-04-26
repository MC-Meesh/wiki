# Subagent 1C: Neural SDF & Implicit Representation Survey
**Project**: Text-to-Voxel Generation PoC  
**Focus**: What's transferable from implicit representations to discrete voxel generation  
**Date**: 2026-04-26

---

## Executive Summary

Neural SDF and occupancy-based implicit representations encode 3D geometry as continuous scalar fields over space. While none generate discrete voxel grids natively, they offer three concrete transfer pathways for the voxel project:

1. **SDF-as-teacher**: Compute a target voxel grid's SDF and use it as an auxiliary training signal (boundary smoothness, eikonal regularization, surface normal consistency).
2. **Voxelized SDF as the generation target**: Instead of generating block-ID tokens directly, generate a voxelized SDF and threshold/snap to discrete IDs at inference (Diffusion-SDF, SDFusion).
3. **Occupancy + surface-normal tokenization**: Augment each voxel position token with its occupancy probability and estimated surface normal vector, giving the model richer geometric signal at each position.

Prior work doing SDF-supervised discrete generation exists but is sparse — the clearest precedent is in medical image segmentation (FocusSDF, SDF-TopoNet) and some 3D scene completion work (GSDF).

---

## 1. DeepSDF (Park et al., CVPR 2019)

**Paper**: [arxiv 1901.05103](https://arxiv.org/abs/1901.05103) | [GitHub](https://github.com/facebookresearch/DeepSDF)

### Internal 3D representation
A latent-conditioned MLP `f_θ(z, x) → s` where `x ∈ R³` is a query point and `s ∈ R` is its signed distance to the nearest surface. The shape is implicitly encoded in latent code `z`. The surface is the zero-level set `{x : f_θ(z, x) = 0}`.

### Voxelization at inference
Yes, straightforward: query on a uniform `N³` grid, then run marching cubes. Cost scales as `O(N³)` MLP forward passes. At 32³ that's ~32K queries — trivial on GPU. At 64³ that's ~260K — still cheap. Surface quality scales with query resolution, not model size.

### Boundary conditions
The SDF gradient `∇f` at the surface equals the inward surface normal. No explicit normal loss is used in DeepSDF itself, but the SDF values around the zero-level set implicitly encode normal direction via finite differences. The eikonal equation `|∇f| = 1` is not enforced as a loss in the original DeepSDF (added later by IGR/SIREN).

### Text conditioning
None in the original. However, 3D-LDM (2022) and SDFusion (CVPR 2023) build on DeepSDF-style autodecoder latents and condition the diffusion model on CLIP text embeddings.

### Transferable to discrete voxel generation
- The latent auto-decoder paradigm (shape as latent code, decoder as continuous function) can be inverted: train your voxel model, then distill its outputs into a DeepSDF-style latent for SDF-based evaluation.
- **Key idea**: Given any target voxel grid in your dataset, you can cheaply compute its exact SDF (just a distance transform on the binary occupancy). This analytic SDF can serve as ground-truth for an auxiliary SDF regression head or loss term during voxel model training — no pretrained SDF model needed.

---

## 2. Occupancy Networks (Mescheder et al., CVPR 2019)

**Paper**: [arxiv 1812.03828](https://arxiv.org/abs/1812.03828) | [GitHub](https://github.com/autonomousvision/occupancy_networks)

### Internal 3D representation
A neural network `f_θ(x, c) → p ∈ [0, 1]` mapping 3D point `x` and conditioning input `c` (image, point cloud, etc.) to occupancy probability. The surface is the `p = 0.5` isosurface.

### Voxelization at inference
Yes. The paper uses a hierarchical multiresolution isosurface extraction: start at coarse resolution, mark active cells (those with mixed occupied/unoccupied corners), subdivide to desired resolution, then run marching cubes. Reported cost is ~3 seconds per mesh at high resolution. At 32³ it's effectively a flat O(32³) query grid — milliseconds on GPU.

The key insight: **occupancy probability is directly interpretable as voxel occupancy**. At any query resolution, you can threshold `p > 0.5` to get a binary voxel grid without running marching cubes at all. This is a conceptually clean bridge to the discrete voxel domain.

### Boundary conditions
The decision boundary (where `p` transitions from 0 to 1) implicitly encodes the surface. No explicit normal or eikonal constraint. The network learns soft boundary behavior from data.

### Text conditioning
Not in the original. Subsequent work (ShapeCrafter NeurIPS 2022) uses vector-quantized deep implicit functions (VQ-DIF) with text conditioning via CLIP.

### Transferable to discrete voxel generation
- **Occupancy probability as a voxel supervision signal**: For each voxel in a training grid, the occupancy value is binary ground truth. But you could train a secondary head to predict smooth occupancy probability rather than just class ID. This encourages the model to learn soft boundary semantics.
- **Resolution independence**: Occupancy Networks showed you can query at any resolution at inference. For a voxel model, analogous behavior would be: train at 16³, query a finer grid at inference using interpolation over learned features.
- **Direct numerical analogy**: Binary voxel occupancy `{0, 1}` is the discrete version of continuous occupancy `p ∈ [0, 1]`. The SDF is the signed distance version of occupancy. Any voxel grid can be converted to either with standard algorithms (scipy distance_transform_edt for SDF, direct lookup for occupancy).

---

## 3. IM-NET (Chen & Zhang, CVPR 2019)

**Paper**: [arxiv 1812.02822](https://arxiv.org/abs/1812.02822) | [GitHub](https://github.com/czq142857/IM-NET)

### Internal 3D representation
Binary classifier `f_θ(z, x) → {0, 1}` — outside or inside the shape — conditioned on shape latent `z`. Like occupancy networks but binary (hard threshold) rather than probabilistic.

Two variants:
- **IM-AE**: Autoencoder for shape representation
- **IM-GAN**: GAN over the latent space for shape generation

### Voxelization at inference
Same as occupancy networks: query on a grid, apply threshold, run marching cubes if mesh is desired. Cheaper than DeepSDF since the output is binary classification, not regression. At 64³ this is very fast.

### Boundary conditions
None explicitly. The binary decision boundary is the surface. No gradient or normal regularization.

### Text conditioning
None in the original. The IM-GAN latent space can be conditioned post-hoc with CLIP guidance but this wasn't done in the paper.

### Transferable to discrete voxel generation
- IM-NET demonstrates that even a **hard binary occupancy** implicit decoder can produce high-quality shapes. For a discrete voxel model with a small block vocabulary (~20 types), you could analogously use a small MLP per voxel position as an implicit decoder head.
- The IM-GAN approach — learn a distribution over shape latents then decode — is structurally similar to a VQ-VAE approach for voxels: learn a codebook of shape latents, model the distribution over codes with a transformer, decode codes to voxel grids.

---

## 4. NeRF (Mildenhall et al., ECCV 2020) — Why It's Not Directly Applicable

**Brief note only.**

NeRF represents scenes as volumetric radiance fields: `f_θ(x, d) → (c, σ)` where `c` is color and `σ` is volume density. It is fundamentally a **rendering model**, not a shape model.

### Why not applicable to discrete voxel generation
1. NeRF encodes view-dependent color and density, not discrete block semantics. There's no natural mapping from density to block type ID.
2. The zero-level set of density is not a well-defined surface — density is a smooth positive field, not a signed field.
3. NeRF requires multiview images for training. Minecraft voxel grids have no natural "view" representation.
4. Extracting a mesh or voxel grid from a NeRF requires thresholding density, which loses semantic block information entirely.

### Partial relevance
Voxel-NeRF hybrids (NSVF, Plenoxels, Instant-NGP) show that **feature grids on voxel vertices** are an efficient scene representation. This idea — store learned features at voxel corners or cell centers, then interpolate — is relevant for a voxel model's internal feature representation, separate from the generation problem.

---

## 5. NGLOD (Takikawa et al., CVPR 2021 Oral)

**Paper**: [arxiv 2101.10994](https://arxiv.org/abs/2101.10994) | [GitHub](https://github.com/nv-tlabs/nglod) | [NVIDIA Research](https://research.nvidia.com/labs/toronto-ai/nglod/)

### Internal 3D representation
Octree-based feature volume where each level of the octree corresponds to a level of detail (LOD). Learnable feature vectors are stored at octree node vertices; a small MLP aggregates multi-scale features to output SDF values. This is a **sparse voxel octree + neural SDF** hybrid.

### Voxelization at inference
Yes. The SDF can be queried at any resolution via sphere tracing (for rendering) or on a grid (for marching cubes). The octree structure means only occupied cells are stored and queried, enabling efficient high-resolution extraction. Rendering is 2-3 orders of magnitude faster than naive NeRF.

### Boundary conditions
The SDF implicitly encodes normals as `∇SDF` at the surface. The octree LOD structure enforces a multi-scale smoothness: coarse levels constrain fine levels. The eikonal equation is not explicitly enforced, but the MLP trained on SDF regression tends to produce near-unit-gradient fields near the surface.

### Text conditioning
None in the original. Not designed as a generative model — NGLOD is a per-shape representation.

### Transferable to discrete voxel generation
- **The sparse octree LOD structure is directly relevant.** For a 32³ voxel grid, most of the interior (air blocks) is empty. NGLOD's insight — only store features at occupied/boundary cells — maps cleanly to a **sparse voxel transformer** architecture.
- **Multi-scale SDF features**: NGLOD's LOD feature stacking could be adapted as an auxiliary feature representation during voxel model training. Each voxel position could be augmented with its SDF value at multiple LOD levels, encoding distance-to-surface information at multiple scales.
- **Practical**: The NGLOD codebase is well-maintained and can compute multi-LOD SDF features for any input geometry efficiently.

---

## 6. DualSDF (Hao et al., CVPR 2020)

**Paper**: [CVPR 2020 PDF](https://openaccess.thecvf.com/content_CVPR_2020/papers/Hao_DualSDF_Semantic_Shape_Manipulation_Using_a_Two-Level_Representation_CVPR_2020_paper.pdf) | [GitHub](https://github.com/zekunhao1995/DualSDF)

### Core concept
Two coupled implicit representations sharing a latent space:
1. **Fine SDF**: High-fidelity implicit surface (standard DeepSDF-style)
2. **Coarse primitive SDF**: Sphere-based abstraction of the same shape for semantic manipulation

A variational auto-decoder (VAD) is trained to produce both representations from the same latent code.

### Key insight for voxel generation
The two-level coupling idea is the most directly transferable concept here. For discrete voxel generation:
- **Fine level**: The discrete voxel grid (block-ID tokens)
- **Coarse level**: A low-resolution semantic abstraction or SDF computed from the fine grid

The coarse level provides an inductive bias for the generator to produce globally coherent shapes before committing to fine-grained block placement. This is analogous to coarse-to-fine generation strategies.

### Text conditioning
None in DualSDF. But the coarse-to-fine architecture maps well to text: text describes coarse semantics ("tower", "cabin") which can guide the coarse SDF, which then constrains the fine voxel generation.

### Voxelization
Both SDF levels can be sampled on a grid and marching-cubed. The fine SDF is the shape representation of interest.

---

## 7. Gradient-SDF (Sommer et al., CVPR 2022)

**Paper**: [arxiv 2111.13652](https://arxiv.org/abs/2111.13652) | [GitHub](https://github.com/c-sommer/gradient-sdf)

### Core concept
Stores **both SDF value and SDF gradient vector** at each voxel in a discretized grid. The gradient field (which equals the inward surface normal field everywhere, not just on the surface) enables more accurate surface reconstruction and direct optimization in voxel space without converting to mesh.

### Relevance
This is the most directly applicable representation for the **occupancy + surface-normal tokenization** idea. The gradient-SDF representation shows:
- Surface normals can be stored per-voxel efficiently
- Gradient information is significantly more accurate than finite differences
- The combined (SDF value, gradient) per-voxel representation enables much sharper reconstructions

### For voxel generation tokenization
Each voxel position token could carry:
```
[block_id (int), sdf_value (float), normal_x (float), normal_y (float), normal_z (float)]
```
During training, the SDF and normal components can be computed analytically from the ground-truth voxel grid (distance transform + gradient of distance transform). At inference, only `block_id` is generated autoregressively; SDF/normal values are discarded or used as auxiliary consistency checks.

---

## 8. Implicit Geometric Regularization — IGR (Gropp et al., ICML 2020)

**Paper**: [arxiv 2002.10099](https://arxiv.org/abs/2002.10099) | [GitHub](https://github.com/amosgropp/IGR)

### Core contribution
Shows that optimizing an MLP to satisfy:
1. `f(x) = 0` for surface points `x ∈ S`
2. `|∇f(x)| = 1` everywhere (eikonal constraint)

...naturally produces smooth SDF solutions without any explicit SDF supervision on non-surface points. The eikonal loss alone regularizes the zero-level set to be geometrically smooth.

### Eikonal loss formula
```
L_eik = E_{x ~ Ω} (||∇_x f_θ(x)|| - 1)²
```

### Surface normal alignment
The eikonal equation implies `∇f` is perpendicular to level sets. At the surface, `∇f` aligns exactly with the surface normal `n`. Providing normal supervision therefore amounts to:
```
L_normal = E_{x ∈ S} ||∇f(x) - n(x)||²
```

### Transfer to voxel generation
The eikonal loss is the theoretical foundation for using SDF gradient supervision. For discrete voxel training:
- Compute the analytic SDF of the target voxel grid
- Compute its gradient (surface normal field) via finite differences or the exact gradient of the distance transform
- Use the eikonal term as an auxiliary loss on any smooth SDF prediction head attached to the voxel generator

This does NOT require a pretrained SDF model — just a CPU-cheap distance transform on each training voxel grid.

---

## 9. SIREN (Sitzmann et al., NeurIPS 2020)

**Paper**: [arxiv 2006.09661](https://arxiv.org/abs/2006.09661) | [Project](https://www.vincentsitzmann.com/siren/)

### Core contribution
MLPs with **sine activation functions** (sinusoidal representation networks) can represent the gradients of signals accurately, solving boundary value problems including the eikonal equation and Poisson equation. SIREN converges faster than ReLU networks on SDF fitting and accurately represents high-frequency detail.

### Relevance
For a voxel model that includes an SDF auxiliary head, using a SIREN-style decoder would improve SDF prediction quality near boundaries. However, SIREN is less commonly used in discrete generation pipelines — the block-ID head is a categorical classifier, and SIREN's advantages are in continuous regression.

---

## 10. Text-Conditioned SDF Models

### 3D-LDM (arxiv 2212.00842, 2022)
Applies latent diffusion to the latent space of a DeepSDF-style autodecoder. Conditioning on CLIP embeddings enables text-to-SDF generation. Mesh/voxel extraction via marching cubes on the queried SDF grid.

### Diffusion-SDF (Li et al., CVPR 2023)
**Paper**: [arxiv 2212.03293](https://arxiv.org/abs/2212.03293) | [GitHub](https://github.com/ttlmh/Diffusion-SDF)

The most relevant text-to-shape model for this project. Architecture:
- **SDF autoencoder** (patch-wise VAE): Encodes 64³ SDF volumes into 8³ latent volumes
- **UinU-Net**: U-Net with an inner local-focused U-Net for patch-independent SDF reconstruction
- **Voxelized diffusion model**: Denoises the 8³ latent conditioned on text (CLIP embedding)
- **Marching cubes** on the decoded 64³ SDF for final mesh

Key numbers: 64³ SDF input → 8³ latent (512x compression). Training uses ShapeNet with text captions.

**Why relevant**: Diffusion-SDF proves the pipeline "encode voxel-resolution SDF → generate latents → decode to SDF → extract shape" works well for text conditioning. The latent size (8³ = 512 tokens) is manageable for a transformer.

### SDFusion (Cheng et al., CVPR 2023)
**Paper**: [CVPR 2023](https://openaccess.thecvf.com/content/CVPR2023/papers/Cheng_SDFusion_Multimodal_3D_Shape_Completion_Reconstruction_and_Generation_CVPR_2023_paper.pdf) | [GitHub](https://github.com/yccyenchicheng/SDFusion)

Compresses 3D SDF into a compact discrete latent space, then runs a diffusion model in that space. Supports multimodal conditioning (text, image, partial shape). Uses a VQ-VAE encoder to discretize the latent, then a diffusion transformer. Text conditioning via CLIP.

**Structural similarity to the voxel project**: SDFusion's pipeline of "VQ-VAE of the 3D representation → transformer/diffusion over discrete tokens" is exactly the architecture pattern for the voxel PoC, just with SDF as the representation instead of block IDs.

### Mosaic-SDF (Yariv et al., CVPR 2024)
**Paper**: [arxiv 2312.09222](https://arxiv.org/abs/2312.09222) | [Meta AI](https://ai.meta.com/research/publications/mosaic-sdf-for-3d-generative-models/)

Represents shapes as a **set of local SDF grids** (patches) spread near the shape boundary. Each local grid is a small voxel patch with SDF values. The set of patches forms a matrix — directly compatible with Transformer attention.

Design principles: fast per-shape computation; parameter-efficient (only boundary regions, not full volume); simple matrix/tensor form for transformers.

**Key insight**: The "mosaic" of local SDF patches is structurally similar to the sparse occupancy tokenization in ShapeFormer/AutoSDF. For the voxel project, an analogous approach would be: only generate tokens for non-air boundary voxels, letting the model skip interior and exterior air implicitly.

### NeuSDFusion (Chen et al., ECCV 2024)
**Paper**: [arxiv 2403.18241](https://arxiv.org/abs/2403.18241)

Uses **triplane SDF** (three orthogonal 2D feature planes) instead of a 3D voxel grid. Memory-efficient. Transformer-based autoencoder with spatial correspondence losses across planes. Outperforms voxel-based methods at equivalent parameter count.

---

## 11. Shap-E (Jun & Nichol, OpenAI 2023)

**Paper**: [arxiv 2305.02463](https://arxiv.org/abs/2305.02463) | [GitHub](https://github.com/openai/shap-e)

### Architecture
Two-stage:
1. **Encoder**: Processes point cloud + rendered views of a 3D asset via cross-attention + transformer, outputs parameters of a small MLP (the implicit function parameters directly as the latent).
2. **Conditional diffusion model**: Generates MLP weight parameters conditioned on text/image CLIP embeddings.

Generates both textured mesh and NeRF renderings from a single implicit function.

### Relevance
Shap-E shows that generating the **weights of a small MLP** is a viable generative target. For voxel generation, this is less direct, but the principle — generate an implicit function rather than explicit tokens — is worth noting. If a voxel model is too sequence-heavy at 32³, generating the weights of a small occupancy network conditioned on text is an alternative approach (though it loses the explicit discrete block-ID semantics).

---

## 12. SDF-Supervised Discrete Generation — Prior Work Survey

### Direct precedents (3D shape domain)

**AutoSDF (Mittal et al., CVPR 2022)**
**Paper**: [arxiv 2203.09516](https://arxiv.org/abs/2203.09516)

Uses a Patch-wise VQ-VAE over SDF volumes to create discrete latent tokens, then a non-sequential autoregressive transformer over those tokens. The SDF is the representation (continuous, encoded into discrete tokens) — the final output is still an SDF, not discrete block IDs. However, this is the closest architectural match to the voxel PoC:
- SDF → VQ-VAE → discrete codebook tokens → autoregressive transformer → decode → SDF → marching cubes → mesh
- Voxel PoC: Block-ID grid → VQ-VAE → discrete tokens → autoregressive transformer → decode → block-ID grid

The key difference: AutoSDF uses SDF as the underlying representation; the voxel PoC uses discrete semantics. The pipeline is isomorphic.

**ShapeFormer (Yan et al., CVPR 2022)**
Uses Vector Quantized Deep Implicit Function (VQ-DIF): spatial position + quantized feature index as a 2-tuple token. Autoregressive transformer over sparse sequences. Handles partial input and generates plausible completions. VQ-DIF is an implicit function decoder, not a voxel grid — but the sparse tokenization over 3D positions directly maps to the voxel setting.

### Medical imaging (SDF-supervised discrete segmentation)

**FocusSDF (2024)**
**Paper**: [arxiv 2511.11864](https://arxiv.org/abs/2511.11864)

Uses SDF as a **loss function** for boundary-aware segmentation. Assigns higher loss weight to voxels near the ground-truth surface (low SDF value). This is exactly the SDF-as-teacher paradigm applied to discrete 3D prediction:
```
L_total = L_cross_entropy + λ * L_SDF_weighted
```
where `L_SDF_weighted` upweights boundary voxels based on their SDF value.

**SDF-TopoNet (2025)**
**Paper**: [arxiv 2503.14523](https://arxiv.org/abs/2503.14523)

Pre-trains on SDF regression (MSE loss), then fine-tunes for discrete segmentation. The SDF pre-training teaches the network boundary geometry before it learns discrete class assignment. This is a direct precedent for **SDF pre-training → discrete voxel generation fine-tuning**.

**GSDF: 3DGS Meets SDF (NeurIPS 2024)**
**Paper**: [NeurIPS 2024](https://proceedings.neurips.cc/paper_files/paper/2024/file/ea13534ee239bb3977795b8cc855bacc-Paper-Conference.pdf)

Combines 3D Gaussian Splatting (an explicit discrete representation) with an implicit SDF branch. Consistency losses enforce that the SDF zero-level set aligns with the Gaussian surface. This mutual regularization between explicit and implicit representations is the clearest 3D precedent for using SDF loss to regularize a discrete representation.

---

## 13. Occupancy-Based Tokenization — Analysis

The question: instead of flat block-ID tokens, tokenize as `(occupancy_prob, normal_x, normal_y, normal_z)` per voxel. Analysis:

### Arguments for
1. **Boundary signal**: The model gets explicit information about which voxels are at surfaces vs. interior vs. exterior. In a 32³ grid with ~20 block types, interior stone blocks are indistinguishable from surface stone blocks by block ID alone. Adding SDF value (or even just a binary is-surface flag) breaks this symmetry.
2. **Normal continuity as an inductive bias**: If the model must also predict normals that are consistent with its block-ID predictions, it's implicitly learning to generate geometrically coherent surfaces. Inconsistent normal predictions can serve as a training signal via an auxiliary eikonal loss.
3. **Smooth interpolation for generation**: Autoregressive generation of continuous SDF values at each position allows the model to "commit" gradually (generate air/surface/interior probabilities before final block type), which may stabilize training.

### Arguments against
1. **Regression vs. classification mismatch**: Block IDs are discrete (categorical cross-entropy); SDF values are continuous (L1/MSE). Training a single transformer to jointly predict both requires careful loss weighting and may increase complexity unnecessarily.
2. **Analytically derivable at training time**: The SDF/normal tokens can be computed from the block-ID ground truth. At inference, only block IDs are needed — the SDF/normal tokens must be generated too, increasing sequence length (4x if adding 3 normal floats + 1 SDF float per position) or handled as a separate auxiliary head.
3. **Complexity**: 32³ × 4 floats per position = 131K float tokens. Even with sparse representation (only non-air), this is heavy. Better to use SDF as an auxiliary loss rather than an explicit token component.

### Recommended approach
Use SDF as an **auxiliary loss signal only** (not as part of the token vocabulary):
- Each voxel position token: `block_id` only (or `block_id + occupancy_logit` as a 2-part token)
- Auxiliary SDF head: separate MLP head that predicts the SDF value from the voxel feature. Trained with eikonal regularization and L1 SDF loss.
- This head is **discarded at inference**; it only provides geometric regularization during training.

---

## Key Transferable Ideas for the Voxel Generation PoC

### Idea 1: Analytic SDF as a Free Training Signal

For every training voxel grid, compute the SDF analytically:
```python
from scipy.ndimage import distance_transform_edt
import numpy as np

def voxel_grid_to_sdf(grid):
    # grid: (N, N, N) int array, 0 = air, >0 = solid
    occupancy = (grid > 0).astype(float)
    dist_outside = distance_transform_edt(occupancy)     # dist from air to nearest solid
    dist_inside = distance_transform_edt(1 - occupancy)  # dist from solid to nearest air
    sdf = dist_outside - dist_inside                     # positive = outside, negative = inside
    return sdf
```
This costs ~1ms per grid on CPU. The resulting SDF gives:
- **Surface voxels**: `|sdf| < 1.5` (within 1.5 voxels of surface)
- **Interior voxels**: `sdf < -1.5`
- **Exterior voxels**: `sdf > 1.5`
- **Normal direction**: `∇sdf` via np.gradient

Use this for:
- **Boundary-weighted loss**: Multiply cross-entropy loss by `exp(-α * |sdf|)` to emphasize surface voxels
- **Auxiliary SDF regression head**: Predict SDF value per voxel position
- **Eikonal regularization on the SDF head**: `L_eik = mean((|∇_x SDF_pred| - 1)²)`

### Idea 2: Voxelized SDF as Intermediate Representation (Diffusion-SDF approach)

Instead of generating block IDs directly, generate a voxelized SDF in a latent space, then decode to block IDs:
1. Train a VQ-VAE on `(voxel_grid → SDF → latent_codes → SDF_reconstructed → block_ID_grid)`
2. Autoregressive transformer over latent codes, conditioned on text
3. Decode latent codes → SDF, then apply block-type assignment from SDF value + position

This separates geometry generation (SDF) from material assignment (block type), which may be easier to learn independently. Tradeoff: adds complexity. Best suited if block-type-from-geometry can be learned (e.g., stone near base, wood at walls, glass at windows correlate with SDF position).

### Idea 3: Sparse Boundary Tokenization (Mosaic-SDF / ShapeFormer inspired)

Only tokenize voxels near the surface (`|sdf| < threshold`). For a Minecraft structure:
- A 32³ grid is mostly air and interior stone
- Surface voxels might be 10-15% of total
- Only generate tokens for boundary positions, let air/interior be implicit

This reduces sequence length by ~7-10x, making the transformer much more tractable. At 32³ with ~3000 surface tokens instead of 32768, even a standard GPT-small can handle this.

Implementation: sort boundary positions by SDF value or Z-scan order, generate `(position, block_id)` pairs.

### Idea 4: SDF Pre-training → Block-ID Fine-tuning (SDF-TopoNet inspired)

Two-phase training:
1. **Phase 1**: Train the voxel transformer to predict SDF values (regression) over the voxel grid, conditioned on text. This teaches spatial geometry and boundary structure.
2. **Phase 2**: Fine-tune the same model to predict block IDs (classification), initializing from Phase 1 weights. The geometric features learned in Phase 1 transfer to the block-ID prediction task.

This is directly supported by SDF-TopoNet's results in medical segmentation.

### Idea 5: AutoSDF-style VQ-VAE Pipeline

The AutoSDF pipeline (CVPR 2022) is the architectural match for the voxel PoC:
```
Target: Block-ID grid → VQ-VAE (patch-wise) → discrete codes → 
        Autoregressive transformer (text-conditioned) → codes → 
        VQ-VAE decoder → Block-ID grid
```
The key modification vs. AutoSDF: replace their SDF patches with block-ID voxel patches. The P-VQ-VAE (Patch-wise VQ-VAE) encodes local spatial patches independently, giving the transformer a manageable sequence length.

At 32³ with 4³ patches: 8³ = 512 patch tokens. Manageable for a ~50M parameter transformer.

---

## Architecture Recommendation for SDF-Supervised Voxel Generation

Based on this survey, the recommended training setup for maximum geometric coherence at minimal complexity:

```
Training input: (text_prompt, voxel_grid_32³)
                         ↓
           Compute SDF analytically (scipy)
                         ↓
[Main path]              [Auxiliary path]
    ↓                         ↓
VQ-VAE encodes          SDF values per voxel
voxel grid to           (pre-computed, stored
patch tokens            alongside dataset)
    ↓
Autoregressive transformer
(GPT-style, ~50-100M params)
- Token: patch index + codebook ID
- Conditioning: text embedding (CLIP/T5)
    ↓
Loss = L_vq + L_recon_block_ids 
     + λ_sdf * L_sdf_auxiliary   ← boundary-weighted, eikonal-regularized
     + λ_boundary * boundary_upweight
```

The SDF auxiliary loss:
```
L_sdf = L1(sdf_pred, sdf_target)
L_eik = mean((|∇ sdf_pred| - 1)²)   [optional, adds ~5% training cost]
L_boundary = CrossEntropy(block_pred) * exp(-α * |sdf_target|)
```

This setup:
- Costs zero extra data collection (SDF computed from voxel grids analytically)
- Adds one small MLP head (~1M params) for SDF prediction
- Provides geometric regularization without requiring any pretrained implicit model
- Is directly motivated by FocusSDF, SDF-TopoNet, and GSDF precedents

---

## Summary Table

| Model | Year | Internal Rep | Voxelizable? | Boundary Encoding | Text Conditioning | Key Transfer |
|---|---|---|---|---|---|---|
| DeepSDF | 2019 | SDF (MLP+latent) | Yes (MC) | Implicit (zero-level set) | No (3D-LDM adds it) | SDF loss from analytic DT |
| OccNet | 2019 | Occupancy field | Yes (direct threshold) | Soft decision boundary | No | Occ prob as soft supervision |
| IM-NET | 2019 | Binary occ (MLP) | Yes (direct threshold) | Hard boundary | No | IM-GAN latent → VQ-VAE analogy |
| NeRF | 2020 | Radiance field | Indirect only | Density threshold | No | Voxel feature grids (indirect) |
| NGLOD | 2021 | Octree SDF | Yes (MC) | Multi-LOD SDF gradient | No | Sparse occupancy tokenization |
| DualSDF | 2020 | Two-level SDF | Yes (MC) | Coarse+fine coupling | No | Coarse-to-fine generation |
| Gradient-SDF | 2022 | Voxel SDF+gradient | Native voxel | Explicit normal field | No | Normal tokenization per voxel |
| IGR | 2020 | MLP SDF | Yes (MC) | Eikonal constraint | No | Eikonal loss formulation |
| SIREN | 2020 | MLP SDF (periodic) | Yes (MC) | Boundary value PDE | No | High-freq SDF fitting |
| 3D-LDM | 2022 | DeepSDF latent | Yes (MC+decode) | Implicit | CLIP | Latent diffusion on SDF space |
| Diffusion-SDF | 2023 | Voxelized SDF | Direct (64³→threshold) | Voxel SDF values | CLIP | Voxelized SDF as generation target |
| SDFusion | 2023 | VQ SDF | Yes | VQ latent | CLIP | VQ-VAE+diffusion pipeline |
| AutoSDF | 2022 | SDF patches (VQ) | Yes | Patch-SDF | CLIP (post) | P-VQ-VAE + AR transformer |
| ShapeFormer | 2022 | VQ-DIF sparse | Yes | Sparse occupancy | - | Sparse boundary tokenization |
| Mosaic-SDF | 2024 | Local SDF patches | Near-boundary | Local patch SDFs | Text | Boundary-only representation |
| NeuSDFusion | 2024 | Triplane SDF | Yes | Triplane constraints | CLIP | Triplane spatial encoding |
| Shap-E | 2023 | MLP weights | Yes (render) | Implicit (NeRF+mesh) | CLIP | MLP-weight generation |

---

## Sources

- [DeepSDF: Learning Continuous Signed Distance Functions for Shape Representation](https://arxiv.org/abs/1901.05103)
- [Occupancy Networks: Learning 3D Reconstruction in Function Space](https://arxiv.org/abs/1812.03828)
- [Learning Implicit Fields for Generative Shape Modeling (IM-NET)](https://arxiv.org/abs/1812.02822)
- [Neural Geometric Level of Detail (NGLOD)](https://arxiv.org/abs/2101.10994)
- [DualSDF: Semantic Shape Manipulation Using a Two-Level Representation](https://openaccess.thecvf.com/content_CVPR_2020/papers/Hao_DualSDF_Semantic_Shape_Manipulation_Using_a_Two-Level_Representation_CVPR_2020_paper.pdf)
- [Gradient-SDF: A Semi-Implicit Surface Representation for 3D Reconstruction](https://arxiv.org/abs/2111.13652)
- [Implicit Geometric Regularization for Learning Shapes (IGR)](https://arxiv.org/abs/2002.10099)
- [SIREN: Implicit Neural Representations with Periodic Activation Functions](https://arxiv.org/abs/2006.09661)
- [Diffusion-SDF: Text-to-Shape via Voxelized Diffusion](https://arxiv.org/abs/2212.03293)
- [SDFusion: Multimodal 3D Shape Completion, Reconstruction, and Generation](https://openaccess.thecvf.com/content/CVPR2023/papers/Cheng_SDFusion_Multimodal_3D_Shape_Completion_Reconstruction_and_Generation_CVPR_2023_paper.pdf)
- [AutoSDF: Shape Priors for 3D Completion, Reconstruction and Generation](https://arxiv.org/abs/2203.09516)
- [ShapeFormer: Transformer-based Shape Completion via Sparse Representation](https://shapeformer.github.io/static/ShapeFormer.pdf)
- [Mosaic-SDF for 3D Generative Models](https://arxiv.org/abs/2312.09222)
- [NeuSDFusion: A Spatial-Aware Generative Model for 3D Shape Generation](https://arxiv.org/abs/2403.18241)
- [Shap-E: Generating Conditional 3D Implicit Functions](https://arxiv.org/abs/2305.02463)
- [ShapeCrafter: A Recursive Text-Conditioned 3D Shape Generation Model](https://arxiv.org/abs/2207.09446)
- [FocusSDF: Boundary-Aware Learning via Signed Distance Supervision](https://arxiv.org/abs/2511.11864)
- [GSDF: 3DGS Meets SDF for Improved Neural Rendering and Reconstruction](https://proceedings.neurips.cc/paper_files/paper/2024/file/ea13534ee239bb3977795b8cc855bacc-Paper-Conference.pdf)
- [Scaffold Diffusion: Sparse Multi-Category Voxel Structure Generation with Discrete Diffusion](https://arxiv.org/abs/2509.00062)
- [3D-LDM: Neural Implicit 3D Shape Generation with Latent Diffusion Models](https://ar5iv.labs.arxiv.org/html/2212.00842)
- [Deep Marching Tetrahedra (DMTet)](https://research.nvidia.com/labs/toronto-ai/DMTet/assets/dmtet.pdf)
- [MeshSDF: Differentiable Iso-Surface Extraction](https://proceedings.neurips.cc/paper/2020/file/fe40fb944ee700392ed51bfe84dd4e3d-Paper.pdf)
