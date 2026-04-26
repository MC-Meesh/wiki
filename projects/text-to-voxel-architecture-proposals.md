---
title: Text-to-Voxel Architecture and Tokenization Strategy Proposals
created: 2026-04-26
updated: 2026-04-26
tags: [text-to-voxel, architecture, tokenization, transformer, voxel, minecraft]
status: active
---

# Text-to-Voxel: Architecture and Tokenization Strategy Proposals

**Scope**: 4 concrete strategies, simplest to most ambitious. Single RTX 3090 (24GB), PoC target 16^3 to 32^3 Minecraft voxel grids, ~20-30 block types.

---

## Strategy 1: Sparse-AR-T5 — Sparse Occupied-Only GPT + T5 Text Conditioning

### Core Idea

Treat occupied voxels as a sparse sequence of `(block_id, x, y, z)` tuples and train a GPT-style decoder-only transformer autoregressively over this sequence, conditioned on a frozen T5-base text encoder via cross-attention. Air tokens are never generated — the model only places blocks. This directly sidesteps the AR collapse problem identified in Scaffold Diffusion without any VQ-VAE complexity. The novel contribution vs prior work is combining sparse-only AR with multi-class block-type vocabularies (prior work uses binary SDF only) and explicit 3D sinusoidal positional encoding on the tuple coordinates.

### Tokenization

**Representation**: Each non-air voxel is a single token drawn from a joint vocabulary of `(block_id, x, y, z)` tuples. At 16^3 with 2% occupancy that is ~82 occupied voxels; at 32^3 with 2% occupancy that is ~655 occupied voxels.

**Vocabulary construction**: Enumerate all `(block_id, x, y, z)` combinations. For 25 block types at 16^3: `25 × 16 × 16 × 16 = 102,400` possible tuple-tokens. At 32^3: `25 × 32 × 32 × 32 = 819,200`. This is extremely large. Alternative: factored prediction — generate `block_id` (25 classes), then `x` (16 or 32 classes), then `y`, then `z` as 4 sequential sub-tokens per voxel. This gives a vocabulary of max(32, 25) = 32 tokens per sub-step, and sequence length of `4 × N_occupied`.

**Factored token scheme (recommended)**:
- Sub-token 1: `block_id` ∈ {0..24} + special tokens `[BOS]`, `[EOS]`, `[PAD]`
- Sub-token 2: `x` ∈ {0..15} or {0..31}
- Sub-token 3: `y` ∈ {0..15} or {0..31}
- Sub-token 4: `z` ∈ {0..15} or {0..31}
- Full vocabulary size: ~60 tokens (union of above sets)
- Sequence length at 16^3 (2% fill, 82 voxels): **328 sub-tokens**
- Sequence length at 32^3 (2% fill, 655 voxels): **2,620 sub-tokens**

**Ordering**: Sort occupied voxels by Morton Z-curve index (computed from x, y, z). This groups spatially adjacent blocks together and is proven to dramatically reduce perplexity vs naive raster scan (Scaffold Diffusion: 3D sinusoidal PE + spatial ordering vs naive = 16× perplexity difference). Apply Morton ordering to the sparse voxel list before flattening to sub-token sequence.

**3D sinusoidal PE**: Add a 3D sinusoidal position embedding to each sub-token group corresponding to the `(x, y, z)` coordinate. This embeds spatial locality directly. Following Scaffold Diffusion's finding, use sinusoidal PE (not learned PE).

**Positional encoding formula for sub-token at coordinate (x, y, z)**:
```python
def sinusoidal_3d_pe(x, y, z, d_model=256):
    # d_model / 6 frequencies per axis
    freqs = 10000 ** (torch.arange(0, d_model // 6) / (d_model // 6))
    pe_x = torch.cat([torch.sin(x / freqs), torch.cos(x / freqs)])
    pe_y = torch.cat([torch.sin(y / freqs), torch.cos(y / freqs)])
    pe_z = torch.cat([torch.sin(z / freqs), torch.cos(z / freqs)])
    return torch.cat([pe_x, pe_y, pe_z])  # shape: [d_model]
```

### Text Conditioning

**Encoder**: Frozen T5-base (220M params, ~880MB). Extract the final encoder hidden states (sequence of token embeddings, not just CLS). Keep T5 frozen throughout training to save VRAM.

**Injection mechanism**: Cross-attention layers in the decoder transformer. Every other transformer layer has a cross-attention sublayer that attends to the T5 encoder output. Architecture:
```
Transformer block:
  LayerNorm → Self-Attention (causal mask) → residual
  LayerNorm → Cross-Attention (K, V from T5 output, Q from hidden state) → residual
  LayerNorm → FFN → residual
```

**Classifier-free guidance (CFG)**: During training, replace the text conditioning with a null embedding (zeros or learned null token) with probability p=0.1. At inference, use CFG with guidance scale γ=3-7:
```
logits_guided = logits_null + γ * (logits_text - logits_null)
```

### Boundary Awareness

**Boundary-upweighted cross-entropy loss**:
```python
# Precompute SDF for each training structure using scipy
from scipy.ndimage import distance_transform_edt
sdf = distance_transform_edt(voxel_grid == 0)  # distance from occupied

# During training, weight loss by proximity to surface
alpha = 2.0
loss_weight = torch.exp(-alpha * sdf_value)  # shape: [N_occupied]
loss = (cross_entropy_per_token * loss_weight).mean()
```
This is ~5 lines of extra code and targets higher gradient signal toward surface boundary blocks. Interior blocks (stone fill) matter less than edge/facade blocks for structural coherence.

**3D sinusoidal PE** (described above) directly encodes spatial relationships.

No eikonal loss in this strategy — kept minimal.

### Training Setup

**Base objective**: Causal language modeling over the sparse token sequence. Teacher forcing.

```python
for batch in dataloader:
    text_emb = t5_encoder(batch["prompts"])  # [B, L_text, 768] — frozen
    tokens = batch["sparse_sequence"]        # [B, L_seq] Morton-sorted sub-tokens
    
    # CFG: randomly null out text conditioning
    null_mask = torch.rand(B) < 0.1
    text_emb[null_mask] = null_embedding
    
    logits = model(tokens[:, :-1], text_emb)  # [B, L_seq-1, vocab_size]
    
    # Boundary-weighted CE
    sdf_weights = batch["sdf_weights"]        # [B, L_seq] precomputed
    loss = F.cross_entropy(logits.reshape(-1, V), tokens[:, 1:].reshape(-1),
                           reduction='none')
    loss = (loss * sdf_weights[:, 1:].reshape(-1)).mean()
    
    loss.backward()
    optimizer.step()
```

**No RL stage.** AdamW, lr=1e-4 with cosine decay, warmup 500 steps.

**Auxiliary objectives**: None in this strategy. Optional: add a structure-completion auxiliary where some blocks are masked and the model must predict them given the rest (like BERT-style pretraining on structures).

### 3090 Feasibility

| Component | Params | VRAM |
|---|---|---|
| Transformer decoder (12L, d=512, 8h) | ~50M | ~4GB |
| T5-base (frozen) | 220M | ~1.8GB fp16 |
| Optimizer states (AdamW fp32) | 50M | ~0.8GB |
| Activations (batch=16, seq=2620) | — | ~6GB |
| **Total** | **270M loaded, 50M trained** | **~13GB** |

Fits comfortably in 24GB. Target batch size B=16 at 32^3, B=64 at 16^3. Training time estimate: 10-20K steps at 32^3 → ~2-4 hours on 3090. Full 50K step run → ~10-20 hours.

### Minecraft Mapping

At inference, sample the sparse token sequence sub-token by sub-token using temperature sampling + top-k (k=50). Collect all `(block_id, x, y, z)` tuples until `[EOS]`. For each tuple: `world.setBlock(x, y, z, BLOCK_MAP[block_id])`. The block vocabulary is a fixed mapping: `{0: AIR, 1: STONE, 2: COBBLESTONE, 3: OAK_LOG, ...}` defined at dataset construction time.

### Novel Contribution vs Prior Work

- ShapeGPT: binary SDF only, dense raster scan. This: multi-class block types, sparse Morton-sorted sequence.
- Scaffold Diffusion: binary occupancy, no text conditioning. This: multi-class, text-conditioned, AR (not diffusion).
- CLIP-Sculptor: coarse-to-fine VQ-VAE pipeline, no sparse tokenization. This: direct sparse AR, simpler architecture.

Main novelty: sparse multi-class autoregressive generation with Morton ordering and 3D sinusoidal PE. Not publication-level but novel enough to be a credible PoC contribution.

### Key Risk

**Sequence order ambiguity**: At 32^3, the model must predict ~2,620 sub-tokens including exact x/y/z coordinates. The factored representation means the model must jointly learn block placement and exact coordinate values — a much harder task than VQ-VAE approaches where coordinates are implicit in the latent grid index. If structures have more than ~2% occupancy (medieval towers might be 10-20%), sequence length explodes: 32^3 at 15% fill = 15,728 voxels = 62,912 sub-tokens. This is entirely infeasible. The model is only practical for truly sparse structures.

---

## Strategy 2: Morton-VQ-AR — Multi-Class VQ-VAE + Morton-Ordered AR Transformer + CLIP Cross-Attention

### Core Idea

Train a 3D convolutional VQ-VAE to compress the full dense voxel grid (including all block types) into a small latent grid, then train an autoregressive transformer over the Morton Z-curve-ordered latent tokens conditioned on CLIP text embeddings via cross-attention. The VQ-VAE handles the density problem — air is compressed away implicitly via the encoder, and each latent token represents a spatial patch of block type distribution. The AR transformer then works at 4-8× lower resolution where sequence length is tractable even for dense structures.

### Tokenization

**VQ-VAE architecture** (multi-class, trained first):
```
Input: [B, N_classes, X, Y, Z]  (one-hot or embedding per voxel)
  → 3D Conv encoder (stride 2, 3 layers): [B, D, X/4, Y/4, Z/4]
  → VQ bottleneck: nearest-neighbor lookup into codebook of size K=512, dim D=256
  → 3D Conv decoder: reconstructs [B, N_classes, X, Y, Z]
  → Output: categorical distribution per voxel (argmax → block_id)
```

For 16^3 input with 4× spatial compression per axis: latent grid = 4^3 = **64 tokens**.
For 32^3 input with 4× spatial compression: latent grid = 8^3 = **512 tokens**.

This is identical to ShapeGPT's 8^3 = 512 token count but extended to multi-class output instead of binary SDF.

**Codebook**: K=512 entries (not 8192 like ShapeGPT — smaller codebook is easier to train, more appropriate for 20-30 block types vs continuous SDF). Embedding dim D=256. EMA updates for codebook stability.

**Ordering**: Flatten the 4^3 or 8^3 latent grid using Morton Z-curve. This is the key improvement over ShapeGPT's naive x→y→z raster scan.

**Morton Z-curve flattening**:
```python
def morton_encode_3d(x, y, z, resolution):
    """Interleave bits of x, y, z to get Morton code."""
    def spread_bits(n):
        n = (n | (n << 16)) & 0x030000FF
        n = (n | (n <<  8)) & 0x0300F00F
        n = (n | (n <<  4)) & 0x030C30C3
        n = (n | (n <<  2)) & 0x09249249
        return n
    return spread_bits(x) | (spread_bits(y) << 1) | (spread_bits(z) << 2)

# Generate Morton-ordered index mapping for 8x8x8 grid
indices = [(morton_encode_3d(x,y,z,8), x, y, z)
           for x in range(8) for y in range(8) for z in range(8)]
morton_order = [idx[1:] for idx in sorted(indices)]
```

**Sequence lengths**:
- 16^3 → 4^3 latent → Morton flattened → **64 tokens** (with BOS/EOS: 66)
- 32^3 → 8^3 latent → Morton flattened → **512 tokens** (with BOS/EOS: 514)

This is a massive reduction from Strategy 1's 2,620+ sub-tokens at equivalent resolution.

**Vocabulary**: VQ codebook indices {0..511} + `[BOS]`, `[EOS]`, `[MASK]` special tokens = 515 total.

### Text Conditioning

**Encoder**: CLIP ViT-L/14 (frozen, ~307M params, ~1.2GB fp16). Extract the text embedding as a 768-dim vector. CLIP is strongly preferred here over T5-base because CLIP's joint image-text embedding space captures visual-semantic relationships ("stone tower" activates visual features) better than T5's pure language embedding.

**Injection mechanism**: Cross-attention in every transformer layer, with the 768-dim CLIP text vector projected to d_model via a learned linear layer. For a single vector (not sequence), expand to a sequence of length 1 before cross-attention:
```python
text_proj = nn.Linear(768, d_model)  # CLIP 768 → d_model
# In forward:
text_kv = text_proj(clip_text_emb).unsqueeze(1)  # [B, 1, d_model]
# Standard cross-attention with K,V from text_kv, Q from hidden state
```

Alternatively, use AdaLN (Adaptive Layer Normalization) as in DiT, which is simpler and avoids extra cross-attention compute:
```python
# AdaLN: scale and shift LayerNorm using CLIP embedding
clip_emb = text_proj(clip_text_emb)  # [B, d_model]
scale, shift = clip_emb.chunk(2, dim=-1)  # [B, d_model/2] each
x = layer_norm(x) * (1 + scale.unsqueeze(1)) + shift.unsqueeze(1)
```

**CFG**: Same as Strategy 1, p_null=0.1, guidance scale γ=3-7 at inference.

### Boundary Awareness

**Boundary-upweighted VQ-VAE reconstruction loss**:
```python
# VQ-VAE reconstruction loss with boundary weighting
recon_logits = decoder(z_q)  # [B, N_classes, X, Y, Z]
sdf = compute_sdf_batch(voxel_grids)  # [B, X, Y, Z], precomputed
alpha = 2.0
boundary_weight = torch.exp(-alpha * sdf.abs())  # [B, X, Y, Z]

ce_loss = F.cross_entropy(recon_logits, block_ids, reduction='none')  # [B, X, Y, Z]
weighted_loss = (ce_loss * boundary_weight).mean()
```

**SDF auxiliary head on VQ-VAE decoder**: Add a lightweight MLP that predicts the SDF value at each voxel position from the decoder features. Add eikonal loss:
```python
sdf_pred = sdf_head(decoder_features)  # [B, 1, X, Y, Z]
# Eikonal: |∇SDF| should equal 1
sdf_grad = torch.gradient(sdf_pred, dim=[2,3,4])
eikonal_loss = ((torch.stack(sdf_grad).norm(dim=0) - 1)**2).mean()
total_vae_loss = weighted_recon_loss + 0.01 * eikonal_loss + vq_loss
```

**3D sinusoidal PE** on the latent token sequence (same formula as Strategy 1, applied at 8^3 resolution).

### Training Setup

**Phase 1: Train VQ-VAE** (no text conditioning)
```
Objective: reconstruction CE + VQ commitment loss + boundary-weighted CE + eikonal auxiliary
Duration: 5K-20K steps
Batch: B=32 at 32^3
LR: 2e-4, Adam
Time: ~2-4 hours on 3090
```

**Phase 2: Train AR transformer** (VQ-VAE frozen)
```python
# Encode all training structures to VQ token sequences (once, offline)
# Then train transformer over these fixed token sequences

for batch in dataloader:
    vq_tokens = encode_to_vq(batch["voxels"])     # [B, 512] cached
    clip_emb = clip_encoder(batch["prompts"])       # [B, 768] frozen
    
    # CFG null conditioning
    null_mask = torch.rand(B) < 0.1
    clip_emb[null_mask] = null_embedding            # learned null token
    
    logits = transformer(vq_tokens[:, :-1], clip_emb)  # [B, 511, K]
    loss = F.cross_entropy(logits.reshape(-1, K), vq_tokens[:, 1:].reshape(-1))
    
    # Optional: boundary-weight individual token losses by avg SDF of patch
    # patch_sdf_weights = precomputed average SDF per 4x4x4 patch
    loss = (loss * patch_sdf_weights.reshape(-1)).mean()
```

**No RL in this strategy.** AdamW, lr=1e-4, cosine decay, warmup 1K steps.

### 3090 Feasibility

| Component | Params | VRAM |
|---|---|---|
| VQ-VAE (3D Conv, 3L down/up, D=256) | ~8M | ~0.5GB (frozen after phase 1) |
| AR Transformer (12L, d=512, 8h, seq=512) | ~50M | ~4GB |
| CLIP ViT-L/14 (frozen) | 307M | ~1.2GB fp16 |
| Optimizer states (AdamW, 50M trained) | — | ~0.8GB |
| Activations (B=32, seq=512) | — | ~4GB |
| **Total** | **~365M loaded, 58M trained** | **~11GB** |

Fits well in 24GB. Batch size B=32-64 at 32^3. VQ token sequences can be cached offline (encode the full training set once). Phase 1 VQ-VAE training: ~2-4h. Phase 2 AR training: ~8-16h. Total PoC: ~12-20 hours wall clock.

### Minecraft Mapping

At inference:
1. Sample VQ token sequence via AR transformer (temperature sampling + top-k=50, CFG guidance)
2. Decode VQ token sequence through frozen VQ-VAE decoder → categorical logits [N_classes, X, Y, Z]
3. Argmax per voxel → block_id grid
4. Filter block_id == 0 (AIR), place all non-air blocks: `world.setBlock(x, y, z, BLOCK_MAP[block_id])`

The 4× spatial downsampling in the VQ-VAE means 32^3 structures are decoded from 8^3 latents. The decoder upsamples with transposed convolutions, so generated structures have spatially coherent block placement even at the original 32^3 resolution.

### Novel Contribution vs Prior Work

- ShapeGPT: binary SDF, naive raster scan, T5. This: multi-class blocks, Morton ordering, CLIP conditioning.
- Scaffold Diffusion: discrete diffusion, binary occupancy, conditioning on boolean scaffold. This: AR over VQ latents, multi-class, text-conditioned with no scaffold.
- CLIP-Sculptor: two-stage VQ-VAE (coarse+fine) + two transformers. This: single VQ-VAE + single AR transformer, simpler pipeline.

Main novelty: first multi-class block-type VQ-VAE with Morton-ordered AR transformer, conditioned on CLIP text embeddings. The Morton ordering + sinusoidal PE combination has not been applied to multi-class voxel generation.

### Key Risk

**VQ-VAE codebook collapse**: With only K=512 codebook entries and multi-class input, it is common for the VQ-VAE to use only a fraction of the codebook (codebook utilization may drop to 10-30%). This limits the expressiveness of the latent space and causes the AR transformer to generate repetitive structures. Mitigation: EMA codebook updates with Laplace smoothing; codebook reset (reinitialize dead codes to random encoder outputs every 1K steps); commitment loss weight β=0.25.

---

## Strategy 3: VQ-AR-GRPO — Full Pipeline with VQ-VAE + AR Transformer + GRPO Reinforcement Learning

### Core Idea

A three-phase training pipeline: (1) train a multi-class 3D VQ-VAE for compression; (2) SFT an autoregressive transformer on VQ token sequences with text conditioning until generation invalidity falls below 10%; (3) GRPO RL fine-tuning with voxel IoU as the reward signal. This is the complete system, following the CAD-Coder GRPO pipeline adapted for voxel generation. The RL stage is feasible because voxel IoU is computed in microseconds vs. CadQuery execution at seconds. The novel contribution is applying GRPO with voxel-structure rewards to multi-class Minecraft block generation.

### Tokenization

**Same VQ-VAE as Strategy 2**, with one critical extension: train the VQ-VAE with a larger codebook K=1024 and higher reconstruction fidelity target. This gives the AR transformer more expressive tokens to work with before RL.

Architecture details (matching Strategy 2 but with K=1024):
- 32^3 → 8^3 = **512 tokens**
- 16^3 → 4^3 = **64 tokens**
- Vocabulary: 1024 VQ codes + 3 special tokens = 1027

**Morton ordering** throughout (same as Strategy 2).

**Boundary-upweighted VQ-VAE reconstruction** (same as Strategy 2).

The key architectural upgrade for Strategy 3: the VQ-VAE decoder outputs a per-voxel categorical distribution (not just argmax), which allows differentiable IoU computation during RL for gradient-based reward shaping.

### Text Conditioning

**Encoder**: CLIP ViT-L/14 (frozen). Same as Strategy 2.

**Injection**: Cross-attention at every transformer layer (preferred over AdaLN for RL stage — cross-attention gives richer text-to-token alignment that RL can exploit to better match text descriptions).

**CFG**: p_null=0.1 during SFT. During GRPO, CFG is applied at inference for the K=8 candidates but not during gradient computation (GRPO treats generation as a black box).

### Boundary Awareness

**Full boundary signal stack**:

1. Boundary-weighted CE in VQ-VAE reconstruction (same as Strategy 2)
2. Eikonal auxiliary on VQ-VAE decoder (same as Strategy 2)
3. **Per-voxel SDF as auxiliary input feature during VQ-VAE training** (Gradient-SDF inspired): concatenate the SDF value to the voxel representation at training time so the encoder learns surface-aware features. At inference, SDF is unavailable (we're generating, not encoding), so drop it at inference — this is a training-only feature:
```python
# Training only: augment input with SDF channel
sdf = compute_sdf(voxels)  # [B, 1, X, Y, Z]
encoder_input = torch.cat([voxels_onehot, sdf.unsqueeze(1)], dim=1)  # [B, N+1, X,Y,Z]
# At inference: zero out the SDF channel
```

4. **Boundary IoU reward term in GRPO** (see Training Setup): reward function can include a boundary precision component that scores whether surface blocks match the reference.

### Training Setup

**Phase 1: VQ-VAE training** (2-4 hours)
```
Input: Multi-class voxel grids [B, N_classes, X, Y, Z]
Objective: boundary-weighted CE + VQ loss + eikonal auxiliary
Steps: 10K-20K
Batch: B=32 at 32^3
```

**Phase 2: SFT on AR transformer** (8-16 hours)
```
Input: VQ token sequences (cached, offline encoded)
Objective: Causal LM with boundary-weighted token-level CE
Stop condition: generation invalidity < 10%
  "invalidity" = fraction of generated structures with IoU < 0.05 vs training distribution
```

SFT training loop pseudocode:
```python
for step, batch in enumerate(sft_dataloader):
    vq_tokens = cached_vq_tokens[batch["ids"]]  # [B, 512]
    clip_emb = clip_encoder(batch["prompts"])     # [B, 768] frozen
    
    logits = transformer(vq_tokens[:, :-1], clip_emb)
    loss = F.cross_entropy(logits.reshape(-1, K), vq_tokens[:, 1:].reshape(-1))
    
    # Monitoring invalidity
    if step % 500 == 0:
        invalidity = measure_invalidity(transformer, val_prompts, vq_decoder)
        if invalidity < 0.10:
            print("SFT complete, starting GRPO")
            break
```

**Phase 3: GRPO RL fine-tuning** (4-8 hours)

GRPO (Group Relative Policy Optimization) parameters:
- K=8 candidate completions per prompt
- Group-normalized rewards: `R̂_i = (R_i - mean(R)) / std(R)` within group
- Clipped surrogate objective (same as PPO clip but group-normalized): ε=0.2
- KL penalty weight β=0.01 (keep policy close to SFT reference)

Reward function:
```python
def compute_reward(generated_vq_sequence, reference_vq_sequence, prompt_text):
    """
    Composite reward. All terms computable in microseconds.
    """
    # Decode VQ sequences to voxel grids
    gen_voxels = vq_decoder(generated_vq_sequence)   # argmax → block_id grid
    ref_voxels = vq_decoder(reference_vq_sequence)   # ground truth
    
    # 1. Voxel IoU (primary signal)
    intersection = (gen_voxels == ref_voxels).sum()
    union = ((gen_voxels != AIR) | (ref_voxels != AIR)).sum()
    iou = intersection / (union + 1e-6)
    
    # 2. Piecewise linear reward (following CAD-Coder)
    #    IoU < 0.1  → R = 0 (no reward for near-random outputs)
    #    0.1 - 0.5  → R = linear 0→0.5
    #    0.5 - 1.0  → R = linear 0.5→1.0 (steeper slope for high-quality outputs)
    if iou < 0.1:
        R_iou = 0.0
    elif iou < 0.5:
        R_iou = (iou - 0.1) / 0.4 * 0.5
    else:
        R_iou = 0.5 + (iou - 0.5) / 0.5 * 0.5
    
    # 3. Block type diversity bonus (prevents mode collapse to all-stone output)
    unique_blocks = len(torch.unique(gen_voxels[gen_voxels != AIR]))
    R_diversity = min(unique_blocks / 5.0, 1.0) * 0.1
    
    # 4. Boundary precision bonus
    gen_surface = extract_surface_voxels(gen_voxels)
    ref_surface = extract_surface_voxels(ref_voxels)
    boundary_iou = compute_iou(gen_surface, ref_surface)
    R_boundary = boundary_iou * 0.1
    
    return R_iou + R_diversity + R_boundary

def grpo_step(prompts, policy, ref_policy, vq_decoder):
    K = 8
    all_rewards = []
    all_log_probs = []
    
    for prompt in prompts:
        clip_emb = clip_encoder(prompt)
        
        # Sample K completions
        candidates = [policy.sample(clip_emb) for _ in range(K)]
        rewards = [compute_reward(c, get_reference(prompt)) for c in candidates]
        
        # Group normalization
        R_mean, R_std = np.mean(rewards), np.std(rewards) + 1e-8
        normalized_rewards = [(r - R_mean) / R_std for r in rewards]
        
        all_rewards.extend(normalized_rewards)
        all_log_probs.extend([policy.log_prob(c, clip_emb) for c in candidates])
    
    # GRPO policy gradient loss
    ratio = torch.exp(log_probs - ref_log_probs.detach())
    clipped = torch.clamp(ratio, 1 - eps, 1 + eps)
    policy_loss = -torch.min(ratio * rewards_tensor, clipped * rewards_tensor).mean()
    
    # KL penalty
    kl_loss = F.kl_div(log_probs, ref_log_probs.detach(), reduction='batchmean')
    total_loss = policy_loss + beta * kl_loss
```

Anti-collapse guard: Do NOT start GRPO until SFT invalidity < 10%. Following CAD-Coder: "GRPO without stable SFT first causes collapse."

### 3090 Feasibility

| Component | Params | VRAM |
|---|---|---|
| VQ-VAE (frozen after P1) | ~8M | ~0.4GB fp16 |
| AR Transformer (16L, d=512, 8h) | ~70M | ~6GB (policy) |
| Reference policy copy (frozen) | ~70M | ~5.5GB fp16 |
| CLIP ViT-L/14 (frozen) | 307M | ~1.2GB fp16 |
| K=8 candidate sequences in GRPO | — | ~2GB |
| Optimizer (AdamW, 70M trained) | — | ~1.1GB |
| **Total** | **~455M loaded, 70M trained** | **~17GB** |

This is tight but feasible on 3090 (24GB). Use fp16 training with gradient checkpointing for the AR transformer during GRPO. Reduce K from 8 to 4 if VRAM pressure exceeds 22GB. Batch size B=8 during GRPO (limited by K×B candidate sequences). GRPO forward passes are non-differentiable (treat generation as black box), so only K gradient computations per step, not K forward passes requiring full activations.

**Training time breakdown**:
- Phase 1 (VQ-VAE): 2-4 hours
- Phase 2 (SFT): 8-16 hours (until invalidity < 10%)
- Phase 3 (GRPO): 4-8 hours (1K-3K GRPO steps)
- **Total: ~14-28 hours** on 3090

### Minecraft Mapping

Same as Strategy 2 for decoding. The GRPO RL stage directly optimizes for voxel IoU against reference structures, which means generated structures are explicitly penalized for placing blocks in wrong positions. The diversity reward prevents the degenerate solution of generating the same single stone cube for every prompt. Block type distribution in the reward can be extended to include semantic block categories (e.g., "stone-like", "wood-like", "decorative") aligned with the text prompt.

A CLIP-similarity reward term is possible if reference images of Minecraft builds are available: `R_clip = CLIP_similarity(render(gen_voxels), prompt_text)`. This would replace the IoU term when no ground-truth reference structure exists at inference time. This is the path to unconstrained generation without paired text-structure training data.

### Novel Contribution vs Prior Work

- ShapeGPT: binary SDF, no RL. This: multi-class blocks, GRPO with voxel IoU reward.
- Scaffold Diffusion: discrete diffusion, no text conditioning, no RL. This: AR + RL.
- CAD-Coder/GRPO: applied to CadQuery code generation, not voxels. This: first application of GRPO to direct voxel structure generation.
- CLIP-Sculptor: no RL, no multi-class VQ-VAE. This: full training pipeline including RL fine-tuning.

**Most novel aspect**: GRPO with voxel IoU reward applied to multi-class 3D voxel AR generation. The boundary IoU sub-reward is a new reward decomposition not previously described for voxel RL.

### Key Risk

**SFT plateau before invalidity < 10%**: If the model fails to reach the invalidity threshold with the available training data (Scaffold Diffusion's 1,432 structures is a small dataset), GRPO will collapse the policy. The dataset size is the hard constraint. Mitigation: augmentation (rotation, reflection, small translations); start GRPO with a higher invalidity threshold (e.g., 20%) and lower KL weight; use LoRA rather than full fine-tuning for Phase 2/3 to reduce parameter count and overfitting risk on small datasets.

---

## Strategy 4: Masked-Diffusion-Voxel — Discrete Diffusion (MDLM) + VQ-VAE + CLIP Cross-Attention

### Core Idea

Replace the autoregressive transformer with a masked discrete diffusion language model (MDLM, following Sahoo et al. 2024) operating on VQ-compressed voxel token sequences. MDLM trains a transformer to predict the original unmasked token from a partially masked sequence, with the masking fraction increasing during training. At inference, start from fully masked and iteratively unmask in T steps (T=10-50). This sidesteps AR collapse entirely (no sequential generation, no teacher forcing on rare tokens) while maintaining the VQ-VAE compression that makes sequence length tractable. Scaffold Diffusion uses this approach and achieves perplexity 1.787 vs AR collapse — but Scaffold Diffusion uses binary occupancy and no text conditioning. This strategy extends it to multi-class block types + text conditioning.

### Tokenization

**Same VQ-VAE as Strategy 2** (K=512, 32^3 → 8^3 = 512 tokens). No change to tokenization.

**Additional [MASK] token**: The discrete diffusion process requires a special `[MASK]` token. Vocabulary: {0..511} + `[MASK]` + `[PAD]` = 514 tokens.

**No ordering requirement**: Unlike AR, masked diffusion does not require a specific token ordering during training. The model sees all positions simultaneously (bidirectional attention). Morton ordering is still used for consistency with the spatial PE, but the order does not affect the fundamental training objective.

**MDLM training process**:
```
For each training step:
  1. Sample masking fraction t ~ Uniform(0, 1)
  2. Mask each token independently with probability t → x_masked
  3. Model predicts p(x_i | x_masked) for all masked positions i
  4. Loss: CE on masked positions only
```

### Text Conditioning

**Encoder**: CLIP ViT-L/14 (frozen), same as Strategies 2/3.

**Injection**: Cross-attention in every transformer layer. For masked diffusion, bidirectional self-attention is used (no causal mask), so the model has full context of all token positions at once. Cross-attention to CLIP text embedding follows the same pattern as Strategy 2.

**CFG**: Applied at inference during iterative unmasking. At each unmasking step, compute logits with and without text conditioning, apply guidance:
```python
for step in range(T):  # T = 20 unmasking steps
    # Which tokens to unmask this step
    n_unmask = determine_schedule(step, T, seq_len)
    
    # CFG
    logits_text = model(x_masked, clip_emb)
    logits_null = model(x_masked, null_emb)
    logits = logits_null + gamma * (logits_text - logits_null)  # gamma = 5.0
    
    # Unmask top-n most confident tokens
    confidence = logits.max(dim=-1).values
    masked_positions = (x_masked == MASK_TOKEN)
    top_n = confidence[masked_positions].topk(n_unmask).indices
    x_masked[masked_positions][top_n] = logits[masked_positions][top_n].argmax()
```

This is the "confidence-based unmasking" strategy from MaskGIT (Chang et al. 2022), adapted for 3D voxel tokens.

### Boundary Awareness

**VQ-VAE boundary awareness**: Same as Strategy 2/3 — boundary-weighted reconstruction CE + eikonal auxiliary. The VQ-VAE is trained identically.

**Diffusion-specific boundary loss**: In MDLM, add a term that upweights the loss on tokens corresponding to surface-adjacent patches:
```python
# For each token position in the 8^3 latent grid,
# compute average SDF of the corresponding 4^3 voxel patch
patch_sdf = compute_patch_average_sdf(voxel_grid)  # [8, 8, 8]
boundary_weight = torch.exp(-alpha * patch_sdf.abs()).flatten()  # [512]

# Apply during MDLM training
masked_positions = (x_masked == MASK_TOKEN)  # [B, 512]
ce_loss = F.cross_entropy(logits[masked_positions], x_orig[masked_positions],
                           reduction='none')
weighted_loss = (ce_loss * boundary_weight.expand_as(ce_loss)).mean()
```

### Training Setup

**Phase 1: VQ-VAE** (same as Strategy 2/3, 2-4 hours)

**Phase 2: MDLM training** on VQ token sequences:
```python
mask_token_id = 512  # special token

for batch in dataloader:
    vq_tokens = cached_vq_tokens[batch["ids"]]   # [B, 512]
    clip_emb = clip_encoder(batch["prompts"])      # [B, 768] frozen
    
    # Sample masking fraction
    t = torch.rand(B, 1)  # [B, 1] different t per sample
    mask = torch.rand(B, 512) < t  # [B, 512] boolean
    
    x_masked = vq_tokens.clone()
    x_masked[mask] = mask_token_id
    
    # CFG null conditioning
    null_mask = torch.rand(B) < 0.1
    text_cond = clip_emb.clone()
    text_cond[null_mask] = null_embedding
    
    # Forward: bidirectional transformer
    logits = transformer(x_masked, text_cond)  # [B, 512, V]
    
    # Loss on masked positions only, with boundary weighting
    ce_loss = F.cross_entropy(logits[mask], vq_tokens[mask], reduction='none')
    patch_weights = boundary_weight[mask.any(0)]  # average over batch dim
    loss = (ce_loss * patch_weights.expand_as(ce_loss)).mean()
```

**No RL stage.** MDLM avoids the collapse problem that motivates RL in Strategy 3. AdamW, lr=1e-4, cosine decay.

**Inference: iterative unmasking** (20 steps, ~0.5 seconds per sample):
```
x = all MASK tokens
for step in 0..T:
    logits = model(x, clip_emb) with CFG
    unmask n_step = schedule(step) positions with highest confidence
x → vq_decoder → block_id grid
```

### 3090 Feasibility

| Component | Params | VRAM |
|---|---|---|
| VQ-VAE (frozen) | ~8M | ~0.4GB |
| Bidirectional Transformer (12L, d=512, 8h) | ~50M | ~4GB |
| CLIP ViT-L/14 (frozen) | 307M | ~1.2GB |
| Optimizer (AdamW, 50M trained) | — | ~0.8GB |
| Activations (B=32, seq=512, bidirectional) | — | ~5GB |
| **Total** | **~365M loaded, 58M trained** | **~12GB** |

Fits comfortably. Bidirectional attention is cheaper than causal attention of the same depth at the same batch size (no causal masking overhead, but full sequence attention). Batch size B=32-64. Training time: ~10-16 hours for MDLM phase.

**Inference speed advantage**: MDLM with T=20 unmasking steps generates a 512-token sequence in 20 transformer forward passes. AR requires 512 sequential forward passes (one per token). MDLM is ~25× faster at inference on the same hardware. For interactive demos, this is a significant practical advantage.

### Minecraft Mapping

Same decode path as Strategy 2/3: iterative unmasking → VQ-VAE decode → argmax block_id → Minecraft placement. The iterative unmasking gives a natural "structure materializing" animation: show the voxel grid at each unmasking step as blocks appear with increasing detail. This makes for a compelling demo.

### Novel Contribution vs Prior Work

- Scaffold Diffusion: discrete diffusion on binary occupancy, conditioned on pre-specified boolean scaffold, no text. This: multi-class blocks, text conditioning via CLIP cross-attention, no scaffold required.
- ShapeGPT: AR with T5. This: MDLM (non-AR), multi-class, CLIP.
- MaskGIT: masked token prediction for 2D image generation. This: adapts MaskGIT-style inference to 3D voxel generation with text conditioning.

**Most novel aspect**: MDLM applied to text-conditioned multi-class 3D voxel generation without a pre-specified scaffold. Extends Scaffold Diffusion to fully unconditional-on-structure, text-conditioned generation.

### Key Risk

**Text conditioning fidelity**: Masked diffusion models are known to be harder to condition precisely than AR models. In image generation, MaskGIT's text conditioning is weaker than AR models like DALL-E. For voxel generation, CLIP cross-attention may produce structures that look plausible but fail to match the semantic content of the prompt (e.g., "tower" generates something tall but not tower-shaped). The non-causal nature of MDLM means the model cannot "build up" semantic structure token-by-token the way AR can. Mitigation: use a stronger CFG scale (γ=7-10 at inference), and optionally add a CLIP similarity term to the unmasking selection criterion.

---

## Decision Framework

### Summary Comparison

| | Strategy 1 | Strategy 2 | Strategy 3 | Strategy 4 |
|---|---|---|---|---|
| **Complexity** | Low | Medium | High | Medium-High |
| **Time to first result** | 1-2 days | 3-5 days | 1-3 weeks | 5-7 days |
| **AR collapse risk** | High (sparse mitigates) | Low | Low | None |
| **Text conditioning quality** | Good (T5) | Better (CLIP) | Best (CLIP+RL) | Good (CLIP) |
| **Sequence length (32^3)** | 2,620+ sub-tokens | 512 tokens | 512 tokens | 512 tokens |
| **Inference speed** | Slow (sequential) | Slow (sequential) | Slow (sequential) | Fast (20 steps) |
| **Novel contribution** | Low | Medium | High | Medium-High |
| **Data requirement** | Low-Medium | Medium | Medium-High | Medium |
| **RL complexity** | None | None | Significant | None |

### Recommendation

**Start with Strategy 2 (Morton-VQ-AR) as the primary path.**

Strategy 1's sparse tokenization is elegant, but the factored coordinate prediction at 32^3 produces a sequence 5× longer than Strategy 2's VQ-compressed 512-token sequence. More critically, Strategy 1 breaks down immediately for any structure with >5% occupancy — a medieval stone tower with walls, floors, and a roof will be 20-40% filled, making the sequence 5,000-16,000 sub-tokens and training entirely infeasible. The occupancy assumption does not hold for the Minecraft use case.

Strategy 2 hits the right balance. The VQ-VAE takes ~4 hours to train, encodes the full structure into a fixed 512-token sequence regardless of occupancy, and the AR transformer is straightforward to implement. CLIP conditioning is stronger than T5 for visual-semantic alignment. Morton ordering with 3D sinusoidal PE is a low-cost implementation that directly addresses the perplexity problem found by Scaffold Diffusion.

**The fastest path to a working text-conditioned voxel generator**:

1. **Day 1-2**: Implement and train the multi-class 3D VQ-VAE. Validate reconstruction quality visually in Minecraft. Verify boundary-weighted loss improves surface detail. Cache all VQ token sequences.

2. **Day 3-4**: Implement the Morton-ordered AR transformer with CLIP cross-attention. Train on cached VQ sequences. Validate that sampling from the model produces coherent structures (not collapsed outputs).

3. **Day 5-6**: Add CFG, tune guidance scale γ. Build the inference pipeline: text → CLIP → AR sample → VQ decode → Minecraft placement. Create a simple demo that accepts text prompts and generates structures.

4. **If results are good**: Proceed to Strategy 3 (GRPO stage) as an optional enhancement. The GRPO stage is 4-8 extra hours of training and requires the SFT model from Strategy 2 as initialization. It is a direct upgrade path.

5. **If AR generates repetitive or collapsed structures**: Fall back to Strategy 4 (MDLM). The VQ-VAE from Strategy 2 is reused entirely — only the transformer training objective changes from causal LM to masked LM. Strategy 4 is a drop-in replacement for the AR phase.

**Concrete implementation order for Strategy 2**:

```
Week 1 (VQ-VAE + data):
  - Collect 1,000-5,000 Minecraft structures from existing datasets
    (Scaffold Diffusion's 1,432, plus VoxelMorph or online schematics)
  - Write voxel I/O: .schematic / .nbt → numpy [N_classes, X, Y, Z] 
  - Implement 3D Conv VQ-VAE (PyTorch, ~100 lines)
  - Train 10K steps, validate reconstruction
  - Cache VQ sequences for all training structures

Week 1-2 (AR Transformer):
  - Implement GPT-style decoder with cross-attention for CLIP
  - Compute Morton order for 8^3 grid (20 lines)
  - Generate 3D sinusoidal PE (10 lines)
  - Train 20K-50K steps on cached sequences
  - Implement CFG inference loop
  - Build Minecraft placement script

Week 2 (Demo + optional RL):
  - Build simple CLI: "python generate.py --prompt 'small stone tower'"
  - Visual validation: place generated structures in Minecraft world
  - Optional: GRPO stage if SFT results look good
```

**What to skip for the PoC**: Don't implement the eikonal auxiliary loss — the boundary-weighted CE alone is sufficient and far simpler. Don't attempt 64^3 grids until 32^3 is working. Don't use T5 when CLIP is available — the visual-semantic embedding is directly better for describing 3D objects. Don't add the SDF input channel to the VQ-VAE encoder (Strategy 3's training-time augmentation) — it adds complexity for marginal gain.

The most dangerous assumption to validate early is whether the training dataset is large enough. Scaffold Diffusion's AR baseline collapsed with 1,432 structures — but that used a dense tokenization. With VQ-VAE compression to 512 tokens, the effective per-sample information density is higher and the model sees more structure per gradient step. 5,000+ training structures is the recommended minimum before committing to Strategy 2.
