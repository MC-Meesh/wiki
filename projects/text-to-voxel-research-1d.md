# Subagent Task 1D: Minecraft + Voxel Game AI Research Survey

**Project:** Text-to-Voxel PoC  
**Date:** 2026-04-26  
**Scope:** All existing ML research on Minecraft structure generation and voxel game AI

---

## Table of Contents

1. [Per-Paper / Per-Project Analysis](#per-paper--per-project-analysis)
   - [Word2Minecraft (arXiv 2503.16536)](#word2minecraft-arxiv-250316536)
   - [APT: Architectural Planning (arXiv 2411.17255)](#apt-architectural-planning-arxiv-241117255)
   - [BuilderGPT / MineClawd (CyniaAI)](#buildergpt--mineclawd-cyniaai)
   - [MCBench (mcbench.ai)](#mcbench-mcbenchai)
   - [BlockGPT (blockgpt.ai)](#blockgpt-blockgptai)
   - [T2BM: 3D Building Generation via LLMs (arXiv 2406.08751)](#t2bm-3d-building-generation-via-llms-arxiv-240608751)
   - [Minecraft Builder Dialog Agent Task / IGLU](#minecraft-builder-dialog-agent-task--iglu)
   - [VoxelCNN / 3D-Craft Dataset (ICCV 2019)](#voxelcnn--3d-craft-dataset-iccv-2019)
   - [World-GAN (arXiv 2106.10155)](#world-gan-arxiv-210610155)
   - [Interactive Latent Variable Evolution (FDG 2023)](#interactive-latent-variable-evolution-fdg-2023)
   - [DreamCraft (arXiv 2404.15538)](#dreamcraft-arxiv-240415538)
   - [Scaffold Diffusion (arXiv 2509.00062)](#scaffold-diffusion-arxiv-250900062)
   - ["Dreaming in Cubes" (VQ-VAE + GPT)](#dreaming-in-cubes-vq-vae--gpt)
   - [NeBuLa: Discourse-Aware Minecraft Builder (EMNLP 2024)](#nebula-discourse-aware-minecraft-builder-emnlp-2024)
   - [GDPC Framework](#gdpc-framework)
   - [GDMC Settlement Generation Competition](#gdmc-settlement-generation-competition)
2. [Dataset Catalog](#dataset-catalog)
   - [rom1504 minecraft-schematics-dataset](#rom1504-minecraft-schematics-dataset)
   - [3D-Craft Dataset (Facebook Research)](#3d-craft-dataset-facebook-research)
   - [IGLU / Microsoft Dataset](#iglu--microsoft-dataset)
   - [Minecraft Dialogue Corpus (ACL 2019)](#minecraft-dialogue-corpus-acl-2019)
   - [Hugging Face: Minecraft-tagged Datasets](#hugging-face-minecraft-tagged-datasets)
   - [Other Schematic Sources](#other-schematic-sources)
3. [Adjacent Non-Minecraft Voxel/3D Generation Work](#adjacent-non-minecraft-voxel3d-generation-work)
4. [Prior Work Gap Analysis](#prior-work-gap-analysis)
5. [Implications for the PoC](#implications-for-the-poc)

---

## Per-Paper / Per-Project Analysis

---

### Word2Minecraft (arXiv 2503.16536)

**Citation:** Huang, Nasir, James, Togelius. "Word2Minecraft: Generating 3D Game Levels through Large Language Models." March 2025.

**1. Direct voxel generation or code/script generation?**
Code / script generation. The system uses GPT-4-Turbo or GPT-4o-Mini to produce a tile-based 2D map with character-to-block mappings. A secondary LLM call translates abstract tiles to specific Minecraft block IDs. A scaling algorithm then expands the 2D map into 3D. The model never outputs a raw voxel array; it outputs structured text that gets interpreted.

**2. Data used / availability**
No training data. Zero-shot prompting only. Builds upon "Word2World" (2D RPG level generation), extended to 3D Minecraft. Code is open-sourced at `https://github.com/JMZ-kk/Word2Minecraft`.

**3. Evaluation metrics**
- Story coherence via direct LLM grading and reconstructed-story cosine similarity
- Tile diversity via Shannon entropy
- Playability: valid unwalkable tile ratio (VUTR), average shortest path across objectives (ASPAO)
- Human preference study with 17 participants (story coherence, visual appeal, functionality, map enjoyment)

**4. Technical failure modes**
- Low main-map coherence accuracy (0.47-0.59); sub-maps fare better (0.82)
- Scaling algorithm occasionally blocks generated paths
- Effectively 2.5D: assumes uniform height — does not generate varied vertical geometry
- Limited block diversity in low-richness prompts
- No structural awareness: the LLM does not "see" a 3D grid; it reasons symbolically

**Summary:** LLM prompt pipeline, not a trained generative model. Not relevant as prior work for direct voxel sequence generation.

---

### APT: Architectural Planning (arXiv 2411.17255)

**Citation:** Chen, Gao. "APT: Architectural Planning and Text-to-Blueprint Construction Using Large Language Models for Open-World Agents." November 2024.

**1. Direct voxel generation or code/script generation?**
Code generation. The LLM (GPT-4) uses chain-of-thought decomposition to produce a structured synopsis (components, dimensions, construction sequence), then translates this into Python code representing a 3D blueprint. The agent executes the Python code to place blocks in-game.

**2. Data used / availability**
No training; uses GPT-4 zero-/few-shot. A custom benchmark of diverse construction tasks is introduced. Memory and reflection modules allow lifelong learning during deployment, but no pre-collected voxel dataset is involved.

**3. Evaluation metrics**
- Accuracy in interpreting multi-item positional instructions
- A/B testing comparing performance with and without memory module
- Qualitative assessment of Redstone-powered interior functionality

**4. Technical failure modes**
- Dependent entirely on GPT-4 spatial reasoning, which is brittle for large or complex structures
- No guarantee of structural validity; the Python code can produce intersecting or floating geometry
- Memory module helps but relies on in-context learning, not a structural prior

**Summary:** LLM agent + code generation + in-game executor. Not direct voxel generation. The benchmark it introduces is potentially useful for evaluating output quality.

---

### BuilderGPT / MineClawd (CyniaAI)

**GitHub:** `https://github.com/CyniaAI/BuilderGPT`

**1. Direct voxel generation or code/script generation?**
Script/schematic generation. BuilderGPT prompts a configured LLM (tested with Gemini 2.5 Pro) to output either a `.schem` schematic file or a `.mcfunction` script for WorldEdit import. The LLM reasons in text about block types and coordinates; it does not produce a raw voxel array.

**2. Data / availability**
No training data. Active development paused in favor of MineClawd. Open source, MIT-like license.

**MineClawd differences:** In-game server-side mod. Executes KubeJS code to place blocks live. More seamless than external schematic import, but still code-generation architecture.

**3. Evaluation metrics**
No formal evaluation published.

**4. Technical failure modes**
- LLM hallucination of block IDs or coordinates
- External workflow (BuilderGPT) is brittle for large structures
- MineClawd still fundamentally generates and executes code

**Summary:** LLM code/schematic generation. Not relevant for direct voxel generation.

---

### MCBench (mcbench.ai)

**Website:** `https://mcbench.ai` | **GitHub org:** `https://github.com/mc-bench`

**What does MCBench actually benchmark?**

MCBench is a human-preference evaluation platform for AI models generating Minecraft structures. It is technically a **programming benchmark**: models are given a text prompt (e.g., "Frosty the Snowman", "a charming tropical beach hut") and asked to **write code** that creates the prompted structure. The generated code is executed in Minecraft and the resulting build is rendered.

Voters are shown two builds side by side and vote for which looks better. This creates an Elo-style leaderboard (similar to LMArena). Models evaluated include those from Anthropic, Google, OpenAI, and Alibaba, all of which have subsidized API access for the project. The platform was created by a high school student (Aditya Singh) in 2025.

**Is it useful as an eval for our model?**

Partially, but with important caveats:
- MCBench measures code-generation quality, not generative model quality. The winning models are the best code writers, not the best structural modelers.
- The evaluation is entirely human-preference based, with no structural metrics (connectivity, material appropriateness, adherence to prompt).
- The benchmark is well-suited for comparing LLM-based code approaches; it cannot be directly applied to a trained generative model that outputs voxel sequences.
- The human preference signal and the prompt set could be extracted and adapted as evaluation data (e.g., use the same prompts and have humans rate generated voxel grids), but MCBench as-is does not plug into a voxel generation pipeline.

**Summary:** Code-generation leaderboard with human preference voting. Not an eval for raw voxel output. Useful prompt catalog. Not a training signal for sequence models.

---

### BlockGPT (blockgpt.ai)

**Website:** `https://blockgpt.ai`

**1. Direct voxel generation or code/script generation?**
The output is `.schem` / `.litematic` schematic files, which are binary voxel representations. The internal mechanism is not publicly documented, but the blog confirms "The AI models powering BlockGPT are constantly improving" with no technical specifics released. Based on output format and generation time (30-60 seconds), this is likely an LLM producing coordinate-mapped block placements encoded into a schematic format, not a trained generative model outputting voxel token sequences.

**2. Data / availability**
Closed-source commercial product. No dataset or model weights available.

**3. Evaluation metrics**
None published. Commercial product with subjective user ratings.

**4. Technical failure modes**
Self-reported in roadmap: limited detail at larger scales, poor material/block selection, weak interior design. Suggests an LLM spatial-reasoning bottleneck.

**Summary:** Closed-source commercial product. Generation mechanism undisclosed. Output is schematic binary (voxel data), but likely generated via LLM coordinate lists. Not useful for research replication.

---

### T2BM: 3D Building Generation via LLMs (arXiv 2406.08751)

**Citation:** "3D Building Generation in Minecraft via Large Language Models." arXiv 2406.08751, 2024.

**1. Direct voxel generation or code/script generation?**
LLM-to-JSON-to-GDPC pipeline. Three stages: (1) expand user prompt; (2) LLM generates a JSON "interlayer" encoding walls, doors, windows with start/end coordinates and materials; (3) post-processing repairs illegal block names. The JSON is decoded into actual placements via the GDPC Python framework.

**2. Data used / availability**
Zero-shot prompting with GPT-3.5 and GPT-4. No training. Uses Minecraft 1.19.2 block identifier lists as context in prompts.

**3. Evaluation metrics**
Two binary flood-fill metrics on 50 trials each:
- Completeness (C): structure forms a connected solid
- Satisfaction (S): all prompt-specified materials present

Results: GPT-3.5 raw prompts: C=66%, S=8%, C∧S=8%. GPT-4 refined prompts: C=82%, S=48%, C∧S=38%.

**4. Technical failure modes**
- Incorrect block identifiers (camelCase vs. snake_case, missing prefixes like "oak_")
- Disallowed block property values (e.g., "occupied" flag on beds)
- Block IDs not in target Minecraft version
- Limited interior generation
- Diminishing returns with additional prompt refinement

**Summary:** Clear LLM-JSON-GDPC pipeline with measurable failure modes. Not voxel sequence generation. Strongest paper in the LLM-code-for-Minecraft category for understanding failure taxonomy.

---

### Minecraft Builder Dialog Agent Task / IGLU

**Core papers:** "Collaborative Dialogue in Minecraft" (ACL 2019); NeurIPS 2021/2022 IGLU Challenges  
**Data repo:** `https://github.com/microsoft/iglu-datasets`

**1. Direct voxel generation or code/script generation?**
Neither — this is a **natural language grounding** task. An architect describes a target structure in natural language; a builder agent must interpret instructions and place blocks. The builder's output is block placements (effectively voxel editing), but the evaluation is whether the resulting grid matches the target.

**2. Data used / availability**
Publicly available at Microsoft's iglu-datasets GitHub. Structure format: 3D numpy arrays of shape `(9, 11, 11)` (H × W × D). The grid is populated with a limited number of colored block types. Dataset includes:
- Multi-turn seed dataset
- Single-turn IGLU dataset
- ~9,000 utterances, ~1,000+ clarification questions
- Up to 200 target structures per competition year, with difficulty ratings (Easy/Normal/Hard)
- Full dialogue history paired with ground-truth target grids

**3. Evaluation metrics**
- F1 on block placement actions (net-action F1)
- Positional accuracy per instruction type (absolute addressing, relative addressing, primitive shapes)
- LLM accuracy on synthetic spatial reasoning test: 43-77% (absolute), 82-96% (relative), 59-60% (shapes)

**4. Technical failure modes**
- LLMs confuse coordinate axes
- Neglect one spatial dimension in complex scenes
- Clarification question handling is hard; most models skip it

**Text-to-voxel applicability:** High. The paired (instruction, target_grid) format is directly usable for training or evaluating a text-conditioned voxel generation model, though grids are small (9×11×11) and block vocabulary is limited (~6 colored block types). Would need augmentation for richer vocabulary.

**Summary:** Best publicly available paired text + voxel dataset specifically for Minecraft. Small grids, limited vocabulary, but paired data is gold.

---

### VoxelCNN / 3D-Craft Dataset (ICCV 2019)

**Citation:** Chen et al. "Order-Aware Generative Modeling Using the 3D-Craft Dataset." ICCV 2019.  
**Code:** `https://github.com/facebookresearch/voxelcnn`

**1. Direct voxel generation or code/script generation?**
**Direct voxel generation.** VoxelCNN is an autoregressive 3D convolutional network that predicts the next block placement given all previous placements. The generation ordering is learned from human construction sequences, not imposed by raster scan.

**2. Data used / availability**
The 3D-Craft Dataset (aka HouseCraft): 2,500 Minecraft houses built from scratch by ~200 human annotators. Each house has a time-stamped sequence of `(x, y, z, block_id)` placements. Average 635 blocks/house; 120 houses exceed 1,500 blocks. Most common block: wood plank (~20% of all blocks). Average 10.9 distinct block types per house. Dataset auto-downloads during training via the GitHub repo.

**3. Evaluation metrics**
- Accuracy@1 (next-block prediction): 0.640
- CCA (canonical correlation analysis) scores for internal representation quality
- No FID or distribution-level metrics reported

**4. Technical failure modes**
- No text conditioning — generation is unconditional
- The autoregressive order is human-mimicking, not necessarily optimal for model training
- Small dataset (2,500 structures); limited block vocabulary
- No evaluation of holistic structural coherence

**Relevance to PoC:** Critical reference. VoxelCNN is the closest thing to "direct voxel sequence generation for Minecraft" that predates 2024. It generates block-by-block in learned human order, with no intermediate code. The 3D-Craft dataset is the most commonly reused benchmark dataset for Minecraft structure generation.

**Summary:** The foundational work for direct voxel generation in Minecraft. Unconditional, block-by-block prediction. 2,500 houses. Publicly available.

---

### World-GAN (arXiv 2106.10155)

**Citation:** Awiszus, Schubert, Rosenhahn. "World-GAN: A Generative Model for Minecraft Worlds." 2021.

**1. Direct voxel generation or code/script generation?**
Direct voxel generation via a 3D GAN. Generates voxel grids at the chunk level from a single example (SinGAN-style).

**2. Data used / availability**
Single user-provided example structure; no large dataset required. Works on community-created structures and procedurally generated world snippets.

**3. Evaluation metrics**
- Visual inspection / qualitative comparison
- Style transfer via manipulation in block2vec embedding space

**4. Technical failure modes**
- Single-example paradigm: learns only from the provided sample; cannot generalize across structure types
- No text conditioning
- "Block2vec" embeddings help with block-type diversity but compress semantic meaning

**Relevance to PoC:** Not directly useful. Single-example GAN cannot be conditioned on text and does not generalize. Architecturally interesting (block2vec) but not a path forward for text-to-voxel.

---

### Interactive Latent Variable Evolution (FDG 2023)

**Citation:** Merino et al. "Interactive Latent Variable Evolution for the Generation of Minecraft Structures." FDG 2023.

**1. Direct voxel generation or code/script generation?**
Direct voxel generation. Two-model pipeline: (1) a 3D GAN generates binary voxel models (structure shape); (2) a 3D CNN "Painter" applies Minecraft-specific block textures/materials to the binary structure.

**2. Data used / availability**
Uses existing 3D voxel models trained on shape datasets. No Minecraft-specific labeled dataset described. User interaction (interactive evolution with aesthetic preference voting) guides generation.

**3. Evaluation metrics**
User study via online interface: participants select, evolve, and guide a population of structures toward a personal aesthetic goal.

**4. Technical failure modes**
- No text conditioning; purely interactive/evolutionary
- The shape GAN and texture CNN are separate models that can produce mismatches
- User-guided evolution requires human-in-the-loop — not automated

**Relevance to PoC:** Demonstrates feasibility of 3D GAN for voxel shape generation. The two-stage shape + texture pipeline is interesting but not text-conditioned.

---

### DreamCraft (arXiv 2404.15538)

**Citation:** Einarsson et al. "DreamCraft: Text-Guided Generation of Functional 3D Environments in Minecraft." FDG 2024.

**1. Direct voxel generation or code/script generation?**
Closest to direct voxel generation among text-conditioned approaches. Uses a **quantized Neural Radiance Field (NeRF)**: optimizes the NeRF to satisfy a text description via score distillation sampling (SDS) from a pretrained image generation model (Emu/Shutterstock), then quantizes continuous NeRF outputs to discrete Minecraft block types using Gumbel-softmax annealing.

**2. Data used / availability**
No training dataset for the generative model — it uses per-prompt optimization (like DreamFusion). The image prior is a proprietary Emu model trained on Shutterstock data. Evaluation uses 153 COCO prompts and 150 Planet Minecraft structure names.

**3. Evaluation metrics**
- R-precision: whether the correct caption ranks first when tested against random distractors, using CLIP (ViT-B/16 and ViT-B/32)
- Evaluated at N×N×N grids where N ∈ {10, 20, 30, 40, 50, 60, 80, 100}; higher N = better fidelity

**4. Technical failure modes**
- Per-structure optimization takes several hours — not scalable
- Semantic grounding issues: no understanding that "wooden ship" should use wooden logs; it just satisfies CLIP without material semantics
- Foreground/background confusion: sometimes represents objects as holes in background blocks
- Flat rendering: cannot model lighting/shadows
- Block vocabulary: only 16 opaque block types

**Relevance to PoC:** DreamCraft claims to be "the first generator capable of generating diverse, functional, and controllable 3D game environments directly from free-form text." However, the per-structure optimization (hours per output) makes it impractical. The quantized NeRF approach is fundamentally different from the autoregressive token generation target of the PoC.

---

### Scaffold Diffusion (arXiv 2509.00062)

**Citation:** Jung. "Scaffold Diffusion: Sparse Multi-Category Voxel Structure Generation with Discrete Diffusion." NeurIPS SPIGM Workshop 2025.  
**Code:** `https://github.com/jsjung00/scaffold-diffusion`  
**Demo:** `https://scaffold.deepexploration.org`

**1. Direct voxel generation or code/script generation?**
**Direct voxel generation.** Treats each occupied voxel as a discrete token. Uses a Diffusion Transformer (DiT) with masked discrete diffusion (MDLM) to generate the set of occupied voxels and their block types.

**Architecture details:**
- 12 transformer blocks, 12 attention heads
- Sequence length: L=1,024 tokens
- Vocabulary: 253 Minecraft block IDs (range 0-255)
- Each token: block ID at a 3D position
- 3D sinusoidal positional embeddings (critical: ablation shows learned PE gives perplexity 29.05 vs 1.787 with sinusoidal)
- Log-linear noise schedule with cached updates
- Input: boolean occupancy map (pre-specified scaffold of occupied positions); model fills in block types

**Dataset:** 3D-Craft (1,432 structures after filtering), 98.3% background sparsity, max 1,024 occupied blocks per structure. Grid sizes tested: 32³ and 64³.

**2. Evaluation metrics**
- NLL: 0.58
- Perplexity: 1.787
- Primarily qualitative evaluation; no FID reported

**3. Technical failure modes**
- Requires a boolean occupancy map as input; does not generate structure shapes end-to-end
- Sequence length caps the number of occupied voxels at 1,024
- No text conditioning

**Relevance to PoC:** The most technically relevant prior work for the voxel-token-sequence approach. Demonstrates that masked discrete diffusion outperforms autoregressive formulations on sparse Minecraft voxel data. However, it requires a pre-specified occupancy scaffold and has no text conditioning — exactly the gaps the PoC would fill.

---

### "Dreaming in Cubes" (VQ-VAE + GPT)

**Source:** Towards Data Science blog post; independent research project.

**1. Direct voxel generation or code/script generation?**
Direct voxel generation. Pipeline: (1) train a 3D VQ-VAE on Minecraft chunk data; (2) flatten the VQ-VAE latent grid into a 1D token sequence; (3) train a GPT with causal self-attention on 8-chunk context windows.

**Architecture:**
- 3D convolutional VQ-VAE (3D kernels across X, Y, Z axes)
- Codebook: 512 unique codes
- Block vocabulary: top 30 blocks by frequency
- Grid: 16×16×384 blocks per chunk; 2×2 chunk output (32×32×384 effective)
- GPT context: 256 tokens from 8 prior chunks
- Top-k sampling with temperature

**2. Data used / availability**
Minecraft Java Edition locally-generated worlds; custom extraction scripts. y ∈ [0, 128] (vertical range). No public dataset release.

**3. Evaluation metrics**
Qualitative only. Learned coherent terrain features (trees, snow-capped peaks, caves, coastlines).

**4. Technical failure modes**
- Lossy VQ-VAE compression causes block-boundary blurring and occasional floating blocks
- No text conditioning (author explicitly flags this as future work)
- Vertical y-range oversight (excluded negative y values added in newer Minecraft versions)
- Codebook collapse mitigated by dead-embedding reinitialization

**Relevance to PoC:** Strong proof of concept for the VQ-VAE + GPT pipeline on Minecraft voxels. Demonstrates that 512 codes suffice for basic terrain grammar. The token serialization (flatten 3D latent grid to 1D) is directly applicable. No text conditioning and no public weights/data, but the blog post provides actionable implementation details.

---

### NeBuLa: Discourse-Aware Minecraft Builder (EMNLP 2024)

**Citation:** Chaturvedi, Thompson et al. "Nebula: A Discourse-Aware Minecraft Builder." EMNLP Findings 2024 (arXiv 2406.18164).

**1. Direct voxel generation or code/script generation?**
NLP/instruction-following task. NeBuLa fine-tunes an LLM to predict block placement actions given the full preceding dialogue and non-linguistic (block placement) context. Output is discrete block placement actions, not a raw voxel array or code.

**2. Data used / availability**
Minecraft Structured Dialogue Corpus (MSDC) with full discourse annotations. Uses "Narrative arc" structure (linked utterances via Narration relations). Builds on Jayannavar et al. (2020) IGLU data.

**3. Evaluation metrics**
Net-action F1 score (placement/removal actions). NeBuLa doubles F1 over the Jayannavar et al. baseline.

**4. Technical failure modes**
- Requires full conversation history; not usable for zero-shot generation from text prompt
- Discourse structure is specific to MSDC annotation schema

**Relevance to PoC:** Limited. NeBuLa is a dialogue-following builder, not a text-to-structure generator. However, the MSDC dataset and its block placement action format could provide additional (instruction, resulting-grid) pairs.

---

### GDPC Framework

**GitHub:** `https://github.com/avdstaaij/gdpc`  
**Docs:** `https://gdpc.readthedocs.io/en/stable/`

GDPC (Generative Design Python Client) is a Python 3 framework for the GDMC-HTTP Minecraft mod. It provides Python bindings for reading/writing Minecraft world blocks in real time, plus high-level tools for settlement generation. It is the most widely used framework in the GDMC competition.

**Relevance to PoC:** GDPC is a deployment utility, not a generative model. It is useful for converting generated voxel arrays into actual Minecraft worlds for visualization and evaluation. Not a training data source.

---

### GDMC Settlement Generation Competition

**Website:** `https://gendesignmc.engineering.nyu.edu/`

Annual competition since 2018 (8+ years). Participants submit algorithms that generate settlements adapting to unseen Minecraft terrain. Judged by human experts on: adaptability, functionality, evocative narrative, visual aesthetics.

**Relevance to PoC:** Competition submissions are primarily procedural (hand-crafted algorithms, L-systems, WFC), with occasional neural entries. The competition's evaluation criteria (adaptability, functionality, aesthetics) are the best human-expert rubric for settlement quality and could inform evaluation design for the PoC. The competition dataset of submitted settlements may be scrapeable for training data.

---

## Dataset Catalog

---

### rom1504 minecraft-schematics-dataset

**GitHub:** `https://github.com/rom1504/minecraft-schematics-dataset`  
**GitLab (actual data):** `https://gitlab.com/rom1504/minecraft-schematics-dataset`

**Source:** Crawled from `minecraft-schematics.com` using a companion JavaScript crawler (`minecraft-schematic-crawler`). The crawler scrapes the index, fetches per-page metadata, and downloads `.schematic` / `.nbt` files.

**Dataset size:** The minecraft-schematics.com site currently hosts ~18,000-20,000 community creations. The exact count in the dataset is not in a public README; the GitLab repo had only 2 commits as of the last check and provides reader tools (Python + JavaScript) rather than a full dataset dump. No public statistics file was found.

**Formats:** `.schematic` (legacy Forge/WorldEdit), `.nbt` (modern Minecraft structures)

**Labels/Tags:** minecraft-schematics.com provides user-assigned category tags (castles, houses, farms, etc.) and metadata (download count, author, Minecraft version). These tags would be scraped with the schematics.

**Size distribution:** Not published. The site hosts everything from single-block decorations to 10,000+ block builds. Filtering to 16³–32³ would require parsing each schematic's dimensions. This is doable with Python `nbtlib` or `mcschematic`.

**Recommended approach:** Use the crawler to fetch all structures, parse dimensions with `nbtlib`, and filter to target size range. Category tags provide weak text labels.

---

### 3D-Craft Dataset (Facebook Research)

**Paper:** VoxelCNN, ICCV 2019  
**Access:** Auto-downloads via `https://github.com/facebookresearch/voxelcnn`

**Size:** 2,500 Minecraft houses built by ~200 human annotators.

**Format:** Time-stamped `(x, y, z, block_id)` sequences — human construction order, not just final voxel state.

**Labels/Tags:** No text labels. Category is exclusively "house."

**Size distribution:** Average 635 blocks/house; 120 houses have >1,500 blocks. Most structures are roughly in the 16³–32³ footprint range (houses, not fortresses).

**Relevance:** Best publicly available dataset with verified human-built structures. The sequence format is unique (preserves building order). No text labels, but structure type is consistent (houses).

---

### IGLU / Microsoft Dataset

**Repo:** `https://github.com/microsoft/iglu-datasets`

**Size:** ~200+ target structures per competition year; thousands of architect-builder dialogue pairs (~9,000 utterances).

**Format:** 3D numpy arrays of shape `(9, 11, 11)` (Height × Width × Depth). Limited colored block vocabulary (~6 types: red, blue, green, yellow, orange, purple + air). Full dialogue transcripts paired with target grids.

**Labels/Tags:** Natural language instructions (per-turn and full sessions). This is the richest source of paired (text, voxel_grid) data for Minecraft.

**Size distribution:** All structures fit within 9×11×11. Too small for 16³-32³ targets, but the paired text-voxel format is invaluable.

**Suitability for PoC:** High for learning text-to-voxel alignment at small scale. Limited block vocabulary is the main constraint. Could be used as part of a curriculum (small simple structures first) or for fine-tuning text conditioning.

---

### Minecraft Dialogue Corpus (ACL 2019)

**Paper:** "Collaborative Dialogue in Minecraft," Narayan-Chen et al., ACL 2019.  
**Access:** `https://juliahmr.cs.illinois.edu/Minecraft/ACL2019.html`

**Size:** 509 full architect-builder conversations with game logs.

**Format:** JSON logs with chat history, builder position, block inventory, and block placements in a 9×9×9 region.

**Labels/Tags:** Natural language dialogue.

**Suitability for PoC:** Small but contains aligned (dialogue, voxel_diff) pairs. Superseded by the larger IGLU dataset for most purposes.

---

### Hugging Face: Minecraft-tagged Datasets

As of April 2026, 46 Hugging Face datasets are tagged "minecraft." Most are irrelevant to voxel structure generation. Notable entries:

| Dataset | Rows | Content | Voxel-relevant? |
|---|---|---|---|
| `James-A/Minecraft-16x-Dataset` | 1,520 | 16×16 block texture images with rich text annotations | No (2D textures) |
| `monadical-labs/minecraft-preview` | 1,022 | 3D character skin renders with text captions | No (character skins) |
| `amd/Micro-World-MC-Dataset` | Unknown | Unknown; likely screenshot/video data | Uncertain |
| `TESS-Computer/minecraft-vla-stage1` | 15.2M | VLA (Vision-Language-Action) stage 1 training | No (agent actions) |
| `TESS-Computer/minecraft-vla-stage2` | 512k | VLA stage 2 | No (agent actions) |
| `naklecha/minecraft-question-answer-700k` | 695k | QA pairs about Minecraft | No |
| `lparkourer10/minecraft-wiki` | ~87.9k | Minecraft wiki content | No |

**Conclusion:** No Hugging Face dataset currently provides 3D voxel structures (schematics or block arrays) with text labels at useful scale. This is a gap.

**Adjacent relevant (non-Minecraft):**
- `ADSKAILab/Make-A-Shape-voxel-16res-20m`: Autodesk model, 20M 3D shapes at 16³ voxel resolution. No text labels for Minecraft-specific vocabulary, but potentially useful for pretraining shape priors.

---

### Other Schematic Sources

| Source | Structures | Labels | Notes |
|---|---|---|---|
| minecraft-schematics.com | ~18,000-20,000 | Category tags, titles | Primary crawl target for rom1504 dataset |
| planetminecraft.com | >100,000 projects, ~2,800 castle-tagged with schematic | Tags, titles, download counts | Large community source; needs scraping |
| mineschematic.com | Unknown | Category | Alternative schematic library |
| abfielder.com | Unknown | — | Smaller curated schematic repo |
| nbt-data.com | Unknown | Tags | Includes NBT structures and datapacks |

**Planet Minecraft** is likely the largest untapped source. Tag-filtered schematic search (e.g., `/projects/tag/castle/?share=schematic`) provides labeled subsets. 2,803+ castle schematics alone are tagged. Total schematics with downloadable files is likely in the tens of thousands.

---

## Adjacent Non-Minecraft Voxel/3D Generation Work

These papers are not Minecraft-specific but are directly relevant to the tokenization and architecture choices for the PoC.

**Octree Transformer (CVPRW 2023, arXiv 2111.12480)**  
Autoregressive 3D shape generation using octrees as a hierarchical representation. Sequentializes the octree by traversal ordering; adaptive compression reduces sequence lengths for large shapes. Works on ShapeNet-style objects. No text conditioning. Relevant for understanding hierarchical tokenization strategies.

**ArchComplete (arXiv 2412.17957, Dec 2024)**  
Two-stage pipeline for 3D architectural design: (1) VQ-VAE encodes voxelized buildings into a discrete patch vocabulary; (2) autoregressive transformer generates coarse voxel grids (64³); (3) hierarchical diffusion upsamples to 512³. Learns a "contextually rich codebook" optimized alongside a 2.5D perceptual loss. Generates real architectural models. No text conditioning but the patch-VQ + AR transformer architecture is directly applicable.

**Scaffold Diffusion (NeurIPS SPIGM 2025, arXiv 2509.00062)**  
Already covered above. Most directly relevant paper to the PoC token-sequence approach.

**G3PT (arXiv 2409.06322)**  
Cross-scale querying transformer for coarse-to-fine 3D generation from point clouds with discrete tokens. Multi-scale AR approach.

**"Dreaming in Cubes" (TDS blog)**  
Already covered above. VQ-VAE + GPT on Minecraft terrain.

**XCube (CVPR 2024 Highlight)**  
NVIDIA. Large-scale 3D generation using sparse voxel hierarchies. Not Minecraft-specific; works on LiDAR and indoor scenes.

---

## Prior Work Gap Analysis

**Has anyone trained a model that directly outputs voxel token sequences for Minecraft structures (not code, not procedural scripts)?**

**Short answer: Nearly, but not with text conditioning. The specific combination of (a) direct voxel token output + (b) text conditioning + (c) structures (not terrain) does not exist in the literature.**

Here is the precise state of the field:

### What exists:

1. **VoxelCNN (ICCV 2019):** Direct autoregressive block-by-block generation of Minecraft houses from the 3D-Craft dataset. Unconditional. Predicts `(x, y, z, block_id)` sequences in human construction order. This is the closest to the PoC target, but predates modern transformer architectures and has no text conditioning.

2. **Scaffold Diffusion (NeurIPS 2025):** Direct discrete-token generation using a Diffusion Transformer on the 3D-Craft dataset. Vocabulary of 253 block types, 32³ or 64³ grids, 1,024 token sequences. No text conditioning. Requires a pre-specified occupancy scaffold (structural layout must be provided externally).

3. **"Dreaming in Cubes":** VQ-VAE + GPT on Minecraft terrain chunks. Unconditional. Direct voxel output. No text conditioning. Not publicly available.

4. **DreamCraft (FDG 2024):** Text-conditioned generation of Minecraft voxel environments via quantized NeRF + SDS. Does produce actual block grids from text. But: per-prompt optimization taking hours (not a trained generative model), only 16 block types, and the approach is fundamentally optimization-based, not sequence generation.

### What does NOT exist:

- A trained transformer (or similar sequence model) that takes a text embedding as input and autoregressively outputs a flattened voxel token sequence for a Minecraft structure
- A dataset of (text description, 3D voxel grid) pairs at 16³-32³ scale with a rich block vocabulary that would enable this training
- Any model that generates complete building structures (towers, cabins, houses) directly as token sequences conditioned on natural language

### Gap confirmation:

The PoC fills a genuine and unexplored niche. The architecture proposed — a transformer conditioned on a text embedding that autoregressively generates serialized voxel tokens — has no direct precedent in the Minecraft/voxel game literature. The adjacent work (VoxelCNN, Scaffold Diffusion) validates that direct discrete-token generation of voxel structures is feasible. The text conditioning component is the unexplored axis.

---

## Implications for the PoC

**Tokenization:** Scaffold Diffusion's approach (extract occupied voxel positions + block IDs, append 3D sinusoidal positional embeddings, pad to fixed sequence length) is validated and directly reusable. Sinusoidal PE is essential — learned PE collapses (perplexity jumps from 1.79 to 29.05 in ablation). For a 32³ grid with ~2% occupancy, this means ~650 tokens per structure on average.

**Architecture choice:** The Scaffold Diffusion result that discrete diffusion outperforms autoregressive formulations on sparse Minecraft data is a critical finding. For sparse structures (< 5% occupancy), order-independent masked diffusion is more natural than left-to-right autoregressive generation. For denser structures or PoC simplicity, a GPT-style AR model is still viable.

**Training data strategy:** The 3D-Craft dataset (2,500 houses) is the primary clean source. IGLU (200+ structures + text pairs) provides the only paired (text, voxel) data. Planet Minecraft + minecraft-schematics.com scraping can extend the corpus to ~20,000+ structures but requires: (1) filtering by size (16³-32³); (2) parsing `.schematic`/`.nbt` with `nbtlib`; (3) sourcing text labels (category tags are the only available labels — no sentence descriptions).

**Text labels are the hardest part.** The field has no dataset of (free-text description, Minecraft voxel structure) pairs at scale. DreamCraft uses CLIP-based R-precision as a proxy; IGLU has real language but trivially small structures. Constructing this dataset — either via scraping tag metadata, generating descriptions with an LLM captioner, or crowdsourcing — is likely the largest non-model bottleneck for the PoC.

**Evaluation:** MCBench is not directly applicable. The best available evaluation strategy is: (1) IGLU held-out set for structure accuracy against ground truth; (2) CLIP R-precision (DreamCraft approach) for text alignment; (3) structural validity metrics from T2BM (flood-fill connectivity, material satisfaction rate); (4) human preference ranking if resources permit.

---

*Sources:*

- [Word2Minecraft arXiv 2503.16536](https://arxiv.org/abs/2503.16536)
- [APT arXiv 2411.17255](https://arxiv.org/abs/2411.17255)
- [APT GitHub](https://github.com/spearsheep/APT-Architectural-Planning-LLM-Agent)
- [CyniaAI BuilderGPT GitHub](https://github.com/CyniaAI/BuilderGPT)
- [MCBench](https://mcbench.ai/)
- [BlockGPT](https://blockgpt.ai)
- [T2BM arXiv 2406.08751](https://arxiv.org/html/2406.08751v1)
- [VoxelCNN GitHub (facebookresearch)](https://github.com/facebookresearch/voxelcnn)
- [World-GAN arXiv 2106.10155](https://arxiv.org/abs/2106.10155)
- [Interactive Latent Variable Evolution FDG 2023](https://dl.acm.org/doi/10.1145/3582437.3587208)
- [DreamCraft arXiv 2404.15538](https://arxiv.org/abs/2404.15538)
- [Scaffold Diffusion arXiv 2509.00062](https://arxiv.org/abs/2509.00062)
- [Scaffold Diffusion GitHub](https://github.com/jsjung00/scaffold-diffusion)
- [Dreaming in Cubes (TDS)](https://towardsdatascience.com/dreaming-in-cubes/)
- [NeBuLa arXiv 2406.18164](https://arxiv.org/abs/2406.18164)
- [IGLU datasets (Microsoft)](https://github.com/microsoft/iglu-datasets)
- [IGLU documentation](https://iglu-contest.github.io/)
- [Minecraft Dialogue Corpus (ACL 2019)](https://juliahmr.cs.illinois.edu/Minecraft/ACL2019.html)
- [rom1504 minecraft-schematics-dataset](https://github.com/rom1504/minecraft-schematics-dataset)
- [GDPC GitHub](https://github.com/avdstaaij/gdpc)
- [GDMC Competition](https://gendesignmc.engineering.nyu.edu/)
- [ArchComplete arXiv 2412.17957](https://arxiv.org/abs/2412.17957)
- [Octree Transformer arXiv 2111.12480](https://arxiv.org/abs/2111.12480)
- [Hugging Face Minecraft datasets](https://huggingface.co/datasets?other=minecraft)
- [MCBench TechCrunch coverage](https://techcrunch.com/2025/03/20/a-high-schooler-built-a-website-that-lets-you-challenge-ai-models-to-a-minecraft-build-off/)
