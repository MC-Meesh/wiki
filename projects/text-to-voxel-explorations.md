# Text-to-Voxel: Architecture Explorations

Side ideas and research findings beyond the main PoC plan. See `text-to-voxel-poc.md` for the primary architecture (Morton-VQ-AR).

---

## Transolver / Physics-Aware Slicing

**Paper**: "Transolver: A Fast Transformer Solver for PDEs on General Geometries" — Wu et al., ICML 2024 Spotlight. arXiv:2402.02366. Code: `thuml/Transolver`.

**Core mechanism**: For N input points, learns a soft assignment matrix W ∈ ℝ^(N×M) mapping each point to M "slices" (content-based, not spatial). Three steps per attention layer:
1. **Slice** (N→M): weighted mean of point features → M slice tokens
2. **Attend**: O(M²) self-attention among M slice tokens only
3. **Deslice** (M→N): broadcast slice tokens back to points using same W

Assignment is computed from input features per layer (linear projection + softmax), meaning two geometrically distant points with similar local context (e.g. two wall surfaces on opposite sides of a building) cluster into the same slice. Complexity is O(N·M + M²) — linear in N.

**LinearNO finding** (arXiv:2511.06294): Physics-Attention is equivalent to linear attention. Removing slice-token self-attention (Step 2) *improves* performance in most symmetric configs. The bottleneck compression (slice + deslice) is the actual inductive bias, not the inter-slice attention.

**The structural role analogy for Minecraft**:

| CFD state | Minecraft analog |
|---|---|
| Boundary layer | Air/solid interface voxels |
| Freestream | Air volume |
| Shock front | Structural transitions (floor→wall, wall→roof) |
| Separated flow | Enclosed interior spaces |

Two wall voxels on opposite sides of a castle cluster together because their local context (solid behind, air in front) matches — semantically richer than spatial downsampling.

**Where it's useful**:

- **Better VQ-VAE encoder**: Replace Conv3d downsampling (32^3 → 8^3 spatial) with Physics-Attention pooling (32^3 → M=128 structural-role tokens). Codebook entries would represent structural concepts rather than spatial patches. Text conditioning attaches naturally at the slice-token level. `Physics_Attention_Structured_Mesh_3D` from the repo takes H/W/D directly — set to 32/32/32, M=128, ~100 lines to integrate.

- **Efficient attention in raw-voxel AR**: Use Physics-Attention as the attention mechanism inside a voxel-level AR model (not VQ-compressed). Each block compresses N voxels to M slices, attends, deslices — O(N·M) vs O(N²). Cleanest realization of "transformer natively reasoning in 3D space."

**Gotcha for generation**: W is computed from current (partial) input. Early in AR generation the grid is mostly air, so slice assignments will be nearly uniform and uninformative. Less of a problem for masked diffusion (Strategy 4) where the full grid is always present but partially masked — Transolver-style attention fits masked diffusion better than causal AR.

---

## 3D-Space Tokenized Transformer

The idea: a transformer that reasons natively in 3D rather than over a flattened 1D sequence — attention weighted by 3D spatial proximity rather than sequence position.

**What this actually resolves to**: The sparse (x,y,z,block_id) tokenization in Strategy 1 is already generating in 3D-indexed space. The meaningful upgrade is making *attention* 3D-local. Two paths:

1. **3D-relative attention bias**: add a learned or sinusoidal 3D distance bias to attention logits — cheap, ~5 lines on top of any existing transformer. The model still operates over a 1D sequence but attention falls off with 3D distance.

2. **Non-autoregressive with 3D attention (masked diffusion + Transolver)**: generate all tokens in parallel with full 3D attention at each denoising step. This is Strategy 4 (MDLM) + Transolver attention. Likely the cleanest full realization of "generation in 3D space."

The tension: causal AR generation needs an ordering, and spatial locality and causal ordering are in conflict. Masked diffusion sidesteps this entirely.

---

## PCA / UMAP Dimensionality Reduction in Latent Space

**The idea**: apply analytical dimensionality reduction (PCA, UMAP) to find a low-dimensional manifold of structures, then learn a mapping from text → reduced coordinates → decode back to voxels. Analogy: eigenfaces for Minecraft structures.

**Why it's interesting**: PCA finds directions of maximum variance — for Minecraft structures these might capture "has walls", "vertical extent", "material heaviness", "enclosed vs. open". A generative model in PC space could be very simple (Gaussian mixture, small MLP) and still produce structurally coherent outputs because the manifold structure does the heavy lifting.

**The categorical data problem**: PCA expects continuous inputs; block IDs are nominal. Options:
- One-hot encode (32 types × 32768 voxels = ~1M-dim — expensive but tractable with randomized SVD)
- Block-frequency embeddings (each voxel → 32-dim soft type vector)
- Work in VQ-VAE latent space instead of raw voxels (see below)

**The sweet spot**: apply PCA to the *VQ-VAE latent space* rather than raw voxels. Each structure is already a 512-dim vector of VQ codes after Strategy 2's encoder. PCA on 512-dim vectors is trivial. The principal directions become interpretable ("castle-ness", "tower-ness", "symmetry"). You could visualize what moving along PC1 does to the generated Minecraft structure — genuinely fun experiment.

**UMAP caveat**: UMAP's inverse transform is unreliable without parametric UMAP (which adds a neural net decoder, at which point you've basically built a VAE anyway). Standard PCA has a clean pseudoinverse. Stick with PCA for the initial experiment.

**Where it's useful**: post-hoc interpretability experiment after Strategy 2 is trained. Not a primary architecture — more of a "what did the VQ-VAE latent space learn?" analysis tool that could double as a lightweight conditional sampler (sample a point in PC space near "castle" cluster → decode → Minecraft schematic).
