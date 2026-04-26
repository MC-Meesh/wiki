# Training Dataset Inventory: Text-to-Voxel Generation PoC
*Subagent Task 3A — Researched 2026-04-26*

---

## Master Dataset Table

| Name | Source | Format | # Samples | Has Text Labels | Needs Conversion | Max Resolution | 3090 Feasible |
|------|--------|--------|-----------|----------------|-----------------|----------------|---------------|
| **rom1504/minecraft-schematics-dataset** | GitHub/GitLab (scraped from minecraft-schematics.com) | .schematic/.schem (NBT gzip) | ~18,000+ (site has 18,794 listed; crawled subset) | No (categories only) | Yes — .schem → numpy array | Variable; majority likely <64^3 | Yes (preprocessing only) |
| **mmmfrieddough/minecraft-schematic-generator** (training data) | Private crawl — "millions of samples from real player builds" | .schem (converted to token seq) | ~10M+ claimed training samples | No | Yes — custom pipeline | Max 15×15×15 (hard constraint) | Yes |
| **zhwang4ai/minecraft-caption** | HuggingFace | Image/caption JSON pairs | 10M+ images | Yes (gameplay captions) | Not directly applicable (gameplay, not structures) | N/A (images) | Yes (but wrong modality) |
| **James-A/Minecraft-16x-Dataset** | HuggingFace | Parquet (image+text) | 1,520 rows | Yes (rich text metadata) | N/A — 2D textures only, not 3D structures | 16×16 px textures | Yes (wrong task) |
| **monadical-labs/minecraft-preview** | HuggingFace | PNG + text | 1,022 images | Yes (character descriptions) | N/A — character skins only | 768×768 renders | Yes (wrong task) |
| **IGLU Datasets (Microsoft)** | GitHub (microsoft/iglu-datasets) | 3D numpy arrays | ~547 dialogue games; 150 target structures | Yes — natural language builder instructions | Ready-to-use (already voxel arrays) | 9×11×11 voxels (tiny) | Yes |
| **Narayan-Chen 2019 Minecraft Corpus** | ACL 2019 / juliahmr.cs.illinois.edu | Game logs + dialogue text | 509 conversations; 150 structures | Yes — paired NL instructions | Yes — game logs → voxel grids | Small (fits in ~20^3) | Yes |
| **MCBench (mcbench.ai)** | mc-bench GitHub org | Generated builds in running Minecraft server | Unknown (evaluation platform) | Yes (text prompts → builds) | Not available as static dataset | Variable | Unknown — data not public |
| **PeterAM4/blockgen-3d** | HuggingFace (voxelized Objaverse) | Parquet; binary numpy [1,32,32,32] | 542,292 (515K train / 27K test) | Partial (names, tags, categories — not full sentences) | No — already voxel grids | 32×32×32 | Yes |
| **tiange/Cap3D** | HuggingFace | CSV captions + .pt point clouds | 1,604,291 (785K Objaverse + 52K ShapeNet + 8K ABO) | Yes — GPT-4 generated captions | Yes — point clouds not voxels; needs voxelization | N/A (point cloud) | Yes (conversion needed) |
| **Text2Shape** | Stanford (text2shape.stanford.edu) | ShapeNet meshes + CSV descriptions | 75,344 text-shape pairs (6,591 chairs + 8,447 tables) | Yes — crowdsourced natural language | Yes — meshes need voxelization | Voxels at 32³ available | Yes |
| **Text2Shape++** | ShapeCrafter project (Brown/NeurIPS) | ShapeNet voxels + text | 369,000 shape-text pairs | Yes | Yes — needs voxelization | 32³ | Yes |
| **ShapeNetCore** | HuggingFace (ShapeNet/ShapeNetCore) | OBJ meshes + categories | ~51,300 unique 3D models; 55 categories | No (category labels only) | Yes — mesh → voxel (binvox) | Variable; voxelizable to 32³ | Yes (conversion heavy) |
| **ShapeNetCore-Vox32 (R2N2)** | 3d-r2n2.stanford.edu | Binary voxel .mat/.npz | ~44,000 models | No (category labels only) | No — already 32³ voxels | 32×32×32 | Yes |
| **ShapeNet-SEM** | ShapeNet/ShapeNetSem-archive HF | OBJ + rich metadata | ~12,000 models; 270 categories | Partial (material, weight, dimensions — not descriptions) | Yes — mesh → voxel | Variable | Yes |
| **Objaverse 1.0** | HuggingFace (allenai/objaverse) | GLB/glTF meshes | ~800,000 3D objects | Via Cap3D (separate download) | Yes — mesh → voxel; large pipeline | Variable | Yes (but pipeline heavy) |
| **Objaverse-XL** | HuggingFace (allenai/objaverse-xl) | GLB/glTF/various | 10M+ 3D objects | Via Cap3D partial coverage | Yes — massive pipeline | Variable | Only subsets |
| **Objaverse++** | GitHub (TCXX/ObjaversePlusPlus) | GLB + attribute annotations | ~500,000 curated models | Yes — quality annotations, ICCV 2025 | Yes — mesh → voxel | Variable | Yes (with filtering) |
| **ABO (Amazon Berkeley Objects)** | AWS S3 (amazon-berkeley-objects) | glTF 2.0 .glb | 7,953 3D models; 147K product listings | Yes — multilingual product descriptions | Yes — mesh → voxel | Variable | Yes |
| **ModelNet40** | modelnet.cs.princeton.edu / HF (Msun/modelnet40) | OBJ / OFF meshes | 12,311 models; 40 categories | No (category labels only) | Yes — binvox → 32³ | Binvoxable to 32³ | Yes |
| **PartNet** | ShapeNet/PartNet-archive HF | OBJ + part annotations | 26,671 models; 573,585 part instances; 24 categories | No (part hierarchy only, no descriptions) | Yes — mesh → voxel | Variable | Yes |
| **ABC Dataset** | deep-geometry.github.io + HF (TimSchneider42) | STEP/OBJ CAD models | 1,000,000 models | No | Yes — CAD → voxel; complex | Variable | Only subsets |
| **3D-FUTURE** | Alibaba Tianchi | OBJ meshes + textures | 9,992 furniture models; 20,240 scenes | Partial (furniture attributes) | Yes — mesh → voxel | Variable | Yes |
| **ShapeGlot (ChairsInContext)** | GitHub (optas/shapeglot) | ShapeNet chairs + utterances | 4,511 chairs; 78,782 utterances | Yes — referential game utterances | Yes — mesh → voxel (32³) | 32³ (ShapeNet chairs) | Yes |

---

## Minecraft-Specific Dataset Deep Dives

### rom1504/minecraft-schematics-dataset

**What it is:** A web crawler + dataset built by Romain Beaumont (also creator of LAION-5B), scraping minecraft-schematics.com. The site currently lists ~18,794 Minecraft community builds. The crawler collects .schematic files (legacy NBT/gzip format) plus page metadata like category tags and download counts.

**Format details:**
- Files: `.schematic` (MCEdit legacy) or `.schem` (WorldEdit modern, Minecraft 1.13+)
- Both are gzip-compressed NBT (Named Binary Tag) format
- Python tooling: `nbtlib`, `nbtschematic`, `mcschematic` PyPI packages
- Easy to parse to numpy arrays via `nbtparse` or custom loaders

**Size distribution — estimated:**
The dataset README is sparse, and no formal size histogram has been published. Based on community context:
- Minecraft's native Structure Block caps at **32×32×32** — structures saved via structure blocks are inherently bounded to this
- Community schematics on minecraft-schematics.com are browsable by size category (small/medium/large). "Small" builds (~<1,000 blocks) likely constitute 30-40% of the catalog
- Typical small decorative builds (fountains, market stalls, small houses) comfortably fit in 16³
- Typical full houses and towers fit in 32³
- Megabuilds (castles, cities) may span 256³ or more

**Rough estimate:** Of ~18K structures on the source site, probably 20-35% fit within a **16³ bounding box** (~3,600–6,000 structures), and **50-65%** fit within a **32³ bounding box** (~9,000–12,000 structures). This is an estimate — exact stats require running the crawler and computing bounding boxes programmatically.

**Text labels:** None natively. The site has categories (medieval, modern, nature, redstone) and download counts, which can be scraped as weak labels. No sentence-level captions.

**Access:** `bash download.sh` from the GitHub repo; actual files on GitLab.

---

### IGLU / Microsoft Collaborative Building Datasets

**What they are:** Two overlapping datasets from the NeurIPS IGLU challenge series and related academic work:

1. **Narayan-Chen et al. 2019 (ACL):** The original "Collaborative Dialogue in Minecraft" corpus. Contains **509 human-human dialogues** for **150 target structures**, yielding **547 dialogue games** split train/dev/test (309/101/137). Architect sees a target structure and gives natural language instructions; Builder acts on them.
   - Structures are small and hand-designed; fit within approximately **11×9×11** blocks
   - Natural language is instructional ("place a blue block on top of the red one"), not descriptive captions
   - GitHub: `prashant-jayan21/minecraft-dialogue-models`

2. **Microsoft IGLU Datasets:** Extension of the above for the NeurIPS 2021/2022 IGLU Challenge. Structures represented as **3D numpy arrays of shape (9, 11, 11)** (height × X × Z).
   - Python API: `pip install git+https://github.com/microsoft/iglu-datasets`
   - Auto-downloads on instantiation
   - Natural language paired with voxel grids — the most directly usable text-voxel paired dataset in the Minecraft domain

**Limitation:** Only ~150-547 unique structures total. Far too small for training from scratch; useful for few-shot eval or fine-tuning only.

---

### mmmfrieddough/minecraft-schematic-generator

An existing open-source project (MIT license) that is the closest prior work to this PoC:
- **Architecture:** Decoder-only transformer, autoregressive, spatial positional encodings
- **Model size:** 79M parameters (6 layers, 6 attention heads)
- **Vocabulary:** 14K–15K unique block types (Iron/Diamond variants)
- **Max grid size:** 15×15×15 — smaller than target 16³
- **Training data:** "Millions of samples from real player builds" (private pipeline)
- **Weights:** Publicly available on HuggingFace
- **Key insight:** They reduced block vocabulary significantly for inference; the raw 14K-block vocab is impractical for PoC — aligns with the plan to use ~20-30 block types

**Does NOT have text conditioning** — pure unconditional generation. This is the gap this PoC fills.

---

### MCBench (mcbench.ai)

A benchmark platform that prompts LLMs with text descriptions and evaluates resulting Minecraft builds by having the LLM execute structure block commands against a live Minecraft server. The evaluation infrastructure is open source (`mc-bench` GitHub org), but the underlying dataset of prompt-structure pairs is not available as a static download. The generated builds are ephemeral (live server execution). **Not usable as a training corpus.**

---

## General 3D + Text Datasets: Key Findings

### PeterAM4/blockgen-3d — TOP RECOMMENDATION FOR NON-MINECRAFT PATH

This is the single most directly usable dataset for the project if you pivot to general voxel generation:

- **542,292 samples** at exactly **32×32×32** — matches PoC target exactly
- **Already voxelized** — no mesh-to-voxel conversion needed
- **Source:** Objaverse (diverse 3D objects across hundreds of categories)
- **Text:** Model names, tags (up to 42 per model), categories (up to 2) — not full sentence captions, but usable as weak conditioning signal
- **Format:** Parquet; `voxels_occupancy` field is `[1, 32, 32, 32]` binary numpy array; `voxels_colors` is `[3, 32, 32, 32]` RGB
- **Gap:** Tags/names are not natural language sentences. Would benefit from Cap3D caption overlay (the UIDs may overlap with Cap3D's Objaverse coverage)

### Cap3D (tiange/Cap3D)

- **1.6M+ shape-caption pairs** — GPT-4V-generated captions for Objaverse, Objaverse-XL, ABO, ShapeNet
- Captions are full English sentences ("Matte green rifle with a long barrel, stock, and sling")
- **No voxel data** — point clouds and rendered images only
- **Key play:** Join Cap3D captions with BlockGen-3D voxels on shared Objaverse UIDs. This gives you `(text, 32³ voxel)` pairs ready for training.

### Text2Shape

- **75,344 pairs** (chairs + tables from ShapeNet); **32³ voxels available**
- Natural language descriptions are crowdsourced via Mechanical Turk — genuinely descriptive ("a chair with four legs and a curved backrest")
- Narrow domain (chairs + tables only) — good for PoC proof of concept, narrow distribution
- Text2Shape++ extends to 369K pairs
- **Directly usable** — one of the only datasets with voxel grids + sentence captions out of the box

### ShapeNet-Vox32 (R2N2)

- Pre-voxelized at 32³, ~44K models
- Category labels only, no text
- Paired with Cap3D this becomes text-labeled
- Available at `3d-r2n2.stanford.edu`

---

## Minecraft Size Distribution: Detailed Analysis

Minecraft's structure block system is natively bounded at **32×32×32** per selection. Community schematics vary widely, but based on the available evidence:

| Size Category | Approximate Block Dimensions | Fraction of Community Builds | Notes |
|---------------|------------------------------|------------------------------|-------|
| Micro/decorative | ≤ 8³ | ~10% | Trees, small props, furniture |
| Small | 8³–16³ | ~25% | Market stalls, small cottages, wells |
| Medium | 16³–32³ | ~30% | Houses, towers, small castles |
| Large | 32³–64³ | ~20% | Mansions, keeps, temples |
| Mega | > 64³ | ~15% | Cities, cathedrals, megabuilds |

**Estimated fit within 16³:** ~35% of community schematics (~6,500 of 18,794 on minecraft-schematics.com)
**Estimated fit within 32³:** ~65% (~12,200 of 18,794)

These figures are estimates based on community category distributions, not hard statistics. To get exact numbers: load the rom1504 dataset, parse each schematic, compute `(width, height, depth)` bounding box, and bin. This is a 1-2 hour script.

---

## Auto-Captioning Cost Analysis

### Approach: Render each structure to 4 isometric views, then caption with a VLM

#### GPT-4o Vision API

**Token calculation for a rendered voxel structure image:**
- Typical rendered view: 512×512 px (isometric, clean render)
- GPT-4o high-detail mode: 85 base tokens + 170 tokens per 512×512 tile
- A 512×512 image = 1 tile → **255 tokens per image**
- 4 views per structure → **1,020 input tokens** per structure
- Output caption (200 tokens avg) → **200 output tokens** per structure

**Pricing (current as of April 2026):**
- GPT-4o standard: $2.50/M input, $10.00/M output
- GPT-4o Batch API (50% discount): $1.25/M input, $5.00/M output

**Cost for 10,000 structures:**

| API Mode | Input Tokens | Output Tokens | Input Cost | Output Cost | Total |
|----------|-------------|---------------|-----------|-------------|-------|
| Standard (sync) | 10.2M | 2.0M | $25.50 | $20.00 | **$45.50** |
| Batch API (async, 24h) | 10.2M | 2.0M | $12.75 | $10.00 | **$22.75** |

**Recommendation:** Use Batch API. For 10K structures, **budget ~$25-30** with GPT-4o (including overhead/retries). Extremely affordable.

---

#### Gemini 2.5 Flash (Google)

- Current pricing: **$0.15/M input tokens, $0.60/M output tokens**
- Image tokenization: ~258–1,290 tokens per image depending on resolution
  - At 512×512: ~265 tokens per image
  - 4 views → ~1,060 input tokens per structure

**Cost for 10,000 structures:**

| | Input Tokens | Output Tokens | Input Cost | Output Cost | Total |
|-|-------------|---------------|-----------|-------------|-------|
| Gemini 2.5 Flash | 10.6M | 2.0M | $1.59 | $1.20 | **$2.79** |

**Gemini 2.5 Flash is ~8x cheaper than GPT-4o Batch.** For 10K structures the cost is essentially negligible (~$3). Caption quality may be slightly below GPT-4o but likely adequate for structure descriptions.

---

#### Local VLMs on the RTX 3090

Running a VLM locally eliminates API cost entirely but requires VRAM and time.

| Model | VRAM Usage | Speed (RTX 3090) | 10K structures @ 4 views/each | Notes |
|-------|-----------|-----------------|-------------------------------|-------|
| **Moondream 2B** | ~2.5 GB | ~184 tokens/sec; ~1.3 samples/sec | ~8.5 hours | Tiny model; quality adequate for short captions |
| **LLaVA-1.5 7B** | ~14 GB | ~10-15 images/min | ~45 hours | Solid quality; large VRAM footprint |
| **LLaVA-Mini** | ~8 GB | ~25 images/sec (40ms latency) | ~27 minutes | Much faster; quality acceptable |
| **InternVL2-8B (AWQ 4-bit)** | ~8 GB | 2.4x faster than FP16 LLaVA | ~20-25 hours (FP16); ~8-10 hours (AWQ) | Strong quality; good for batch jobs |
| **Qwen2-VL-7B** | ~14 GB (fits 3090) | Moderate; good for ≤1024px | ~20-30 hours | Strong multimodal reasoning |

**Practical recommendation for 10K structures:** Use **LLaVA-Mini** or **Moondream** for a first pass (fast + cheap), then use **Gemini 2.5 Flash API** (~$3) for a final quality pass or to regenerate weak captions. The 3090 can run these locally without blocking training.

---

## Recommended Data Pipeline

### Path A: Minecraft-First (Recommended for PoC)

**Goal:** 10K–20K (text, 32³ voxel) pairs in Minecraft block vocabulary

```
Step 1: Acquire schematics
  - Download rom1504/minecraft-schematics-dataset (~18K structures)
  - Supplement with IGLU datasets (~150 structures, text already paired)

Step 2: Filter by bounding box
  - Parse each .schematic/.schem with nbtlib or mcschematic
  - Compute (W, H, D) bounding box
  - Keep only structures where max(W, H, D) ≤ 32
  - Expected yield: ~9,000–12,000 structures from rom1504

Step 3: Vocabulary reduction
  - Map full Minecraft block palette → 25-block simplified vocabulary
    {air, stone, cobblestone, granite, wood_planks, oak_log, glass,
     sand, gravel, dirt, grass_block, leaves, water, lava, torch,
     fence, slab, stairs, door, chest, crafting_table, furnace,
     wool[color], brick, cobblestone_wall}
  - Everything else → nearest semantic match or "stone" fallback

Step 4: Voxelization / normalization
  - Center the structure in a 32³ grid
  - Save as numpy uint8 array [32, 32, 32]

Step 5: Auto-caption
  Option A (fast/cheap): Render 4 isometric views → Gemini 2.5 Flash (~$3 for 10K)
  Option B (free/local): LLaVA-Mini or Moondream on 3090 (~30 min–8 hrs)
  Option C (best quality): GPT-4o Batch API (~$25 for 10K)

  Rendering: Use mineways (open source Minecraft → mesh exporter) or
  build a simple Python renderer using matplotlib/matplotlib-3d or
  pyvista for isometric block renders

Step 6: Caption augmentation
  - Append weak labels from site categories (e.g., "medieval building",
    "modern house") as additional training signal
  - IGLU pairs provide instructional text — convert to descriptive captions
    via a brief LLM rewrite pass

Step 7: Train/val split
  - 90/10 split; hold out IGLU structures for eval (ground-truth text pairs)
```

**Estimated final dataset:** 8,000–12,000 training pairs + 150 eval pairs (IGLU)

---

### Path B: General Voxels (Faster Start, Less Minecraft-Specific)

**Goal:** Use BlockGen-3D + Cap3D for a quick sanity-check dataset

```
Step 1: Download PeterAM4/blockgen-3d (542K 32³ voxel grids, already ready)

Step 2: Download tiange/Cap3D captions CSV for Objaverse

Step 3: Join on Objaverse model_id (UID field)
  - BlockGen-3D has model_id field; Cap3D has same UIDs
  - Estimate: ~60-70% overlap → ~320K paired (caption, 32³ voxel) samples

Step 4: Quality filter
  - Filter by caption length (>20 words preferred)
  - Filter by voxel density (>5% occupied — removes near-empty objects)
  - Expected yield after filtering: ~150K–200K high-quality pairs

Step 5: Optional — fine-tune on Minecraft vocabulary
  - After initial training on general voxels, fine-tune on Minecraft
    subset using Path A data
```

**Advantage:** Immediate start with zero preprocessing. Validates model architecture before building Minecraft pipeline.

---

### Hybrid Recommendation

1. **Week 1:** Start training on BlockGen-3D + Cap3D (zero-prep, 542K samples). Prove the transformer architecture generates coherent 32³ voxels conditioned on text.
2. **Week 2-3:** Build Minecraft schematic pipeline (Path A). Generate auto-captions with Gemini Flash (~$3).
3. **Week 4:** Fine-tune on Minecraft data. Eval against IGLU held-out pairs.

---

## Dataset Feasibility Summary

### For 16³ PoC (easiest start)
- **Best option:** IGLU + Narayan-Chen (already 9×11×11, text-paired) — but only ~150 structures, needs augmentation
- **Scale to:** rom1504 filtered to ≤16³ (~6K structures) + auto-captions

### For 32³ PoC (recommended target)
- **Best general option:** BlockGen-3D + Cap3D join (no preprocessing, 300K+ pairs, 32³)
- **Best Minecraft option:** rom1504 filtered + Gemini captioning (~10K pairs)
- **Best text-quality benchmark:** Text2Shape (voxels already at 32³, genuine NL descriptions, chairs/tables only)

### RTX 3090 Feasibility Notes
- All datasets listed are 3090-feasible for training at 32³ grid size
- The 3090's 24GB VRAM can hold a ~50-100M param transformer + batch of 64× 32³ voxel grids (each 32KB as float32 = 2MB per batch) — ample headroom
- Preprocessing (voxelization, rendering) is CPU-bound; run overnight
- Local VLM captioning (Moondream, LLaVA-Mini) fits on 3090 alongside a paused training run

---

## Sources

- [rom1504/minecraft-schematics-dataset GitHub](https://github.com/rom1504/minecraft-schematics-dataset)
- [mmmfrieddough/minecraft-schematic-generator HuggingFace](https://huggingface.co/mmmfrieddough/minecraft-schematic-generator)
- [mmmfrieddough/minecraft-schematic-generator GitHub](https://github.com/mmmfrieddough/minecraft-schematic-generator)
- [zhwang4ai/minecraft-caption HuggingFace](https://huggingface.co/datasets/zhwang4ai/minecraft-caption)
- [PeterAM4/blockgen-3d HuggingFace](https://huggingface.co/datasets/PeterAM4/blockgen-3d)
- [tiange/Cap3D HuggingFace](https://huggingface.co/datasets/tiange/Cap3D)
- [microsoft/iglu-datasets GitHub](https://github.com/microsoft/iglu-datasets)
- [Narayan-Chen et al. 2019 ACL Paper](https://juliahmr.cs.illinois.edu/Minecraft/ACL2019.html)
- [MCBench (mcbench.ai)](https://mcbench.ai/)
- [Text2Shape Stanford](http://text2shape.stanford.edu/)
- [Text2Shape Papers With Code](https://paperswithcode.com/dataset/text2shape)
- [ShapeNet/ShapeNetCore HuggingFace](https://huggingface.co/datasets/ShapeNet/ShapeNetCore)
- [allenai/objaverse-xl HuggingFace](https://huggingface.co/datasets/allenai/objaverse-xl)
- [Objaverse ALLENAI](https://objaverse.allenai.org/)
- [ObjaversePlusPlus GitHub ICCV 2025](https://github.com/TCXX/ObjaversePlusPlus)
- [Amazon Berkeley Objects Dataset](https://amazon-berkeley-objects.s3.amazonaws.com/index.html)
- [ABO Amazon Science](https://www.amazon.science/code-and-datasets/amazon-berkeley-objects-abo-dataset)
- [ShapeGlot GitHub](https://github.com/optas/shapeglot)
- [PartNet Dataset GitHub](https://github.com/daerduoCarey/partnet_dataset)
- [ABC Dataset](https://deep-geometry.github.io/abc-dataset/)
- [3D-FUTURE arXiv](https://arxiv.org/abs/2009.09633)
- [OpenAI API Pricing](https://openai.com/api/pricing/)
- [GPT-4o Image Token Calculation Community Thread](https://community.openai.com/t/how-do-i-calculate-image-tokens-in-gpt4-vision/492318)
- [Gemini Developer API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini 2.5 Flash Pricing](https://pricepertoken.com/pricing-page/model/google-gemini-2.5-flash)
- [Moondream 2B Model Card](https://huggingface.co/vikhyatk/moondream2)
- [Moondream 2025 Release Blog](https://moondream.ai/blog/introducing-a-new-moondream-1-9b-and-gpu-support)
- [LLaVA-Mini Paper arXiv](https://arxiv.org/html/2501.03895v1)
- [NeurIPS IGLU 2022 Challenge](https://www.aicrowd.com/challenges/neurips-2022-iglu-challenge)
- [MineRL BASALT NeurIPS 2023](https://arxiv.org/abs/2312.02405)
- [MineDojo](https://minedojo.org/)
- [3D-R2N2 ShapeNetVox32](http://3d-r2n2.stanford.edu/)
- [Dreaming in Cubes — TDS Minecraft VQ-VAE+GPT](https://towardsdatascience.com/dreaming-in-cubes/)
- [GPT-4o Batch API 50% Discount](https://community.openai.com/t/batch-api-pricing-for-gpt-4o-2024-08-06/918686)
- [minecraft-schematics.com](https://www.minecraft-schematics.com/)
- [nbtschematic PyPI](https://pypi.org/project/nbtschematic/)
- [mcschematic PyPI](https://pypi.org/project/mcschematic/)
