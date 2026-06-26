---
name: ikai-ingest-workflow
description: "REQUIRED for running an ikai ingest session. Use when a developer asks to add a source document to their knowledge base, process an article, or grow the wiki. Triggers: ikai ingest, ingest session, add source, process article, add to wiki, add to knowledge base, ingest this file. Excludes query, maintenance, and connection-finding operations (use ikai-query-workflow, ikai-maintenance-workflow, or ikai-connect-workflow instead). Excludes debugging ingest pipeline code (use ingest-pipeline skill)."
---

# ikai Ingest Workflow Skill

## When This Skill Applies

**USE FOR:**
- Developer provides a source file path and asks to add it to the knowledge base
- Any phrase like "ingest this", "add to my wiki", "process this article/paper/notes", "add to knowledge base"
- Running `ikai ingest <file>` as part of a session
- After `ikai ingest`, running `ikai render` and reading `wiki/log.md` to validate the result

**DO NOT USE FOR:**
- Answering questions from the graph (use `ikai-query-workflow`)
- Running health checks or lint (use `ikai-maintenance-workflow`)
- Debugging or extending ingest pipeline source code in `packages/cli/src/ingest/` (use `ingest-pipeline` skill)

## Core Knowledge

### Design Principles

1. **Title-first** — Work with node titles, not UUIDs. Use `ikai resolve` to look up IDs when needed.
2. **Use `--llm` for CLI output** — Commands support `--llm` for compact output. Use it when reading command results.
3. **Quality over quantity** — A well-distilled `concept` node with 150 words beats a copy-pasted `section` with 800 words. Extraction quality matters more than node count.
4. **Layer 1 first, Layer 2 second** — Complete the structural skeleton before adding semantic overlay. Never mix the two passes.

### The Ingest Loop (Step-by-Step)

Execute these steps in order. The agent handles all file I/O — the developer only makes decisions at the dedup confirmation step.

**Step 0 — Detect the active namespace, then verify format and mount status**

Before doing anything else, determine the active namespace from the workspace. Read `.ikai/config.yaml` in the current workspace root (or walk up the directory tree to find it). The `namespace:` field is the active namespace.

```bash
# Read .ikai/config.yaml from the workspace root — no CLI command needed, just read the file
# Example content:
# mount_namespaces:
#   - @devuser/karpgist   ← this is the active namespace
# readonly_namespaces: []
```

**Never guess or invent the namespace. Never default to `@owner/project`.** If `.ikai/config.yaml` is missing, run `ikai init <name>` (the developer must confirm `<name>`) — this creates the namespace directory and config in one step.

Once detected, use that namespace for ALL subsequent commands. Then verify format and mount status:

Namespaces must be fully lowercase: `@owner/project` (e.g. `@devuser/karpgist`). Uppercase letters, spaces, and special characters (except `-` and `_`) are rejected. Correct the namespace before proceeding.

```bash
ikai graph --status --namespace @owner/project
```
If the namespace is not initialized, run `ikai init <name>` first.

**Step 1 — Produce the extraction JSON**

`ikai ingest` requires `--extracted <json-path>`. The CLI does **not** perform AI extraction itself — the agent must produce the extraction JSON before calling `ikai ingest`.

Read the source document in **two layers** and generate an extraction JSON file at `raw/<source-name>.extraction.json`.

---

#### Layer 1 — Section skeleton (structural)

Every heading-delimited section becomes exactly one `section` node. No section may be omitted.

- Use the heading text verbatim as `title`. Include the full section body unchanged — section nodes are the archival record of the source.
- Set `section_index` (1-based sequential position), `heading_level` (1=`#`, 2=`##`, etc.), and `parent_section_title` for child sections.
- Do NOT add `derived_from` or `extends` edges for sections — the CLI auto-creates those.

#### Layer 2 — Knowledge overlay (semantic)

After completing Layer 1, re-read each section. For each distinct concept, claim, tool, practice, framework, or entity mentioned, create a typed node with a **distilled** body:

| Source content | Node type | Body target |
|---|---|---|
| An idea, principle, or practice | `concept` | ≤200 words — synthesize the core idea |
| An assertion, finding, or hypothesis with evidence | `claim` | ≤150 words — the claim + its justification |
| A concrete thing: tool, person, org, standard | `entity` | ≤100 words — what it is and why it matters here |

**Distillation rule**: Concept/claim/entity bodies must be your synthesis of the idea — not copied text from the source. Ask: "if someone never reads the original, can they understand this concept from this node body?" If yes, it's distilled. If it's just a rephrased quote, it's not.

Then add edges **between** concept/claim/entity nodes:
- `defines` — when a concept formally introduces or explains another
- `supports` — when a claim provides evidence for another claim or concept
- `extends` — when a concept specializes or builds on another
- `contradicts` — when two claims are genuinely in conflict
- `mentions` — when a section or concept references another in passing

And add edges from concept/claim/entity nodes **back to the sections they appear in**:
- Use `derived_from` — e.g., concept "Spec-First" derived_from section "The Specification Spectrum"

> **Quality bar**: Look at `raw/karpathy-llm-wiki.extraction.json` for target style. Note how every node has a typed, distilled body and how edges carry semantic meaning. The SDD extraction (`raw/spec-driven-development-2602.00180.extraction.json`) is the anti-pattern — 28 `section` nodes with verbatim bodies and 18 sparse edges.

---

**Full extraction JSON schema:**

```json
{
  "source_path": "./raw/source-file.md",
  "proposed_nodes": [
    {
      "title": "Section Heading Title",
      "type": "section",
      "body": "Full verbatim content of this section.",
      "section_index": 1,
      "heading_level": 2
    },
    {
      "title": "Core Concept Name",
      "type": "concept",
      "body": "Synthesized explanation of the concept in ≤200 words. Your words, not the source's."
    },
    {
      "title": "Key Claim About X",
      "type": "claim",
      "body": "The assertion and the evidence supporting it, ≤150 words."
    },
    {
      "title": "Tool or Framework Name",
      "type": "entity",
      "body": "What it is, what it does, why it matters in this source's context. ≤100 words."
    }
  ],
  "proposed_edges": [
    {
      "from_title": "Core Concept Name",
      "to_title": "Section Heading Title",
      "type": "derived_from",
      "weight": 0.9
    },
    {
      "from_title": "Core Concept Name",
      "to_title": "Related Concept",
      "type": "supports",
      "weight": 0.8
    }
  ]
}
```

`proposed_edges` uses `to_title` to reference another node in this extraction batch. Cross-graph edges (connecting to existing nodes outside this document) are handled separately by `ikai-connect-workflow` after ingest.

Valid node types: `concept`, `claim`, `entity`, `source`, `synthesis`, `section`.  
Valid edge types: `contradicts`, `supports`, `defines`, `extends`, `derived_from`, `mentions`, `proposes_change_to`.

> **Auto-created edges**: The CLI automatically creates `derived_from` edges from every node to the source node, `extends` edges from each child section to its `parent_section_title`, and `defines` edges from each parent section to its children. Do NOT add these to `proposed_edges`.

**Extraction quality checklist — verify before finalizing:**
- [ ] Type diversity: <70% of nodes are `section` (the rest are `concept`/`claim`/`entity`)
- [ ] Edge density: ≥0.8 intra-document edges per node (excluding auto-created edges)
- [ ] Body conciseness: `concept`/`claim`/`entity` bodies average ≤200 words
- [ ] Edge type diversity: ≥3 distinct edge types used

> **Cross-graph connections are NOT part of ingest.** After ingest, use `ikai-connect-workflow` to find connections between the newly ingested nodes and the rest of the knowledge graph. Ingest only processes the document itself.

**Step 2 — Run ingest**
```bash
ikai ingest ./raw/source-file.md \
  --namespace @owner/project \
  --extracted ./raw/source-file.extraction.json
```
The CLI stores the raw source, computes SHA-256 content hash, runs Jaccard title similarity against the existing graph, creates nodes/edges, and outputs results including any dedup candidates.

**Step 3 — Handle dedup candidates** *(if any)*

If the CLI surfaces near-duplicate nodes (title similarity above the configured threshold), the agent MUST:
1. Present each candidate pair clearly: `new node title` vs **existing node title** `prefix`
2. State the similarity score
3. Ask the developer to choose for EACH candidate:
   - **merge** — fold the new content into the existing node (`ikai update node <id> --body ...`)
   - **skip** — discard this node from the ingest run
   - **new** — create as a distinct node (proceed as normal)

**The agent MUST NOT proceed past this step until the developer has responded for every candidate.** Proceeding without confirmation risks silent graph corruption.

**Step 4 — Render updated wiki pages**
```bash
ikai render --all --namespace @owner/project
```
Regenerates all wiki pages affected by the ingest. `wiki/index.md` and `wiki/log.md` are updated as derived artifacts. The agent MUST NOT edit these files directly — `ikai render` is the only permitted path.

**Step 5 — Confirm what changed**
```bash
# Read ~/.ikai-data/log.md to find the session entry
```
The most recent entry in `~/.ikai-data/log.md` will list: timestamp, source file ingested, nodes created/updated, and wiki pages regenerated.

**Step 6 — Report to developer**
Summarise: how many nodes were added, which wiki pages changed. Then suggest running connect:
> "Ingest complete. Added 3 nodes (2 concepts, 1 source). Updated wiki page 'Distributed Systems'. Session logged at 2026-04-10T14:23."
> "Want me to find connections between the new nodes and the rest of your graph? (This uses the connect workflow.)"

### Namespace Check (Before Ingest)

Before running `ikai ingest`, verify the namespace is mounted and uses the correct format. Namespaces must be lowercase `@owner/project`:
```bash
ikai graph --status --namespace @owner/project
```
If no namespace is active, run `ikai init <name>` first. Never ingest into an uninitialized namespace.

### What ikai ingest Produces

- A `source` node (type `source`) representing the file itself with its content hash
- One `section` node per heading-delimited section — every section, no exceptions (Layer 1)
- `concept`, `claim`, and `entity` nodes for the key ideas within the source (Layer 2)
- `derived_from` edges from every node → source node (auto-created by the CLI)
- `extends` edges from each child section → its parent section (auto-created by the CLI)
- `defines` edges from each parent section → its child sections (auto-created by the CLI)
- Any additional intra-document edges specified in `proposed_edges` (semantic relationships within the source)
- An entry appended to `wiki/log.md` in your namespace directory

> **Cross-graph connections**: Ingest does not create connections to existing nodes outside the document. After ingest, run the `ikai-connect-workflow` to link the new nodes into the broader graph.

### After Ingest: What NOT to Do

- **NEVER** edit `wiki/index.md`, `wiki/log.md`, or any `wiki/*.md` directly
- **NEVER** insert nodes manually into the graph store — use `ikai ingest` or `ikai add`
- **NEVER** skip `ikai render --all --namespace <ns>` — the wiki is stale until render runs

## Edge Cases

- **New namespace / first ingest (no existing nodes)**: If this is the developer's first ingest into a namespace, `ikai lint --orphans` run afterward will flag every node (all are unconnected). This is expected behaviour. Skip orphan lint until at least 5 nodes exist and advise the developer: "Orphan lint is most useful after the graph has a few connected nodes."

- **Contradiction on ingest**: If an extracted node has content that conflicts with an existing node (e.g., a `claim` node that contradicts a stored claim), the agent MUST surface the conflict explicitly:
  > "The new node 'CAP theorem applies to all distributed systems' conflicts with existing node **CAP theorem is a trade-off, not a universal constraint** `abc12345`. Which claim should win?"

## ikai Command Reference (Ingest-Relevant)

A quick reference for commands used in the ingest workflow.

### Namespace / mount

```bash
ikai graph --status --namespace @owner/project   # verify namespace is mounted
ikai init my-project                             # initialize namespace (creates .ikai/config.yaml)
```

### Ingest

```bash
ikai ingest <file> --namespace <ns> --extracted <json>
  # <file>       — path to the raw source document
  # --namespace  — target namespace (from .ikai/config.yaml)
  # --extracted  — path to the agent-produced extraction JSON
  # --json       — machine-readable output
```

### Node mutations (used at dedup / merge step)

```bash
ikai add node --type <type> --title "<title>" --body "<body>" --namespace <ns>
  # Valid types: concept | claim | entity | source | synthesis | section

ikai update node <id> --body "<new body>"    # refresh an existing node's content
```

### Render (MANDATORY after ingest)

```bash
ikai render --all --namespace <ns>   # regenerate all wiki pages for the namespace
ikai render --namespace <ns>         # regenerate only changed pages
# NEVER edit wiki/*.md directly — always go through ikai render
```

### Edge types (valid set)

| Type | Direction | Meaning |
|------|-----------|---------|
| `derived_from` | child → parent | this node was extracted from / built on parent |
| `supports` | A → B | A provides evidence for B |
| `contradicts` | A → B | A conflicts with B |
| `defines` | A → B | A gives the definition of B |
| `extends` | A → B | A builds on or specialises B |
| `mentions` | A → B | A references B without stronger commitment |
| `proposes_change_to` | A → B | A is a proposal to modify B |

- **Source already ingested (same content hash)**: The CLI will detect the duplicate via SHA-256 content hash and report "source already ingested". Inform the developer and skip re-ingest unless they explicitly ask to re-process with updated content.

- **Ingest partially fails**: If the CLI exits with a non-zero code after extracting some nodes, do NOT run `ikai render` yet. Report the partial failure, show which nodes were stored and which failed, and ask the developer whether to proceed with a partial render or roll back.

## Common Pitfalls

### Shared Formatting Rules (all ikai workflows)

These rules apply to all user-facing output from any ikai workflow skill.

**Citation format**: When referencing a node in output to the developer, use the node title in bold with the first 8 hex chars of the UUID in backticks: **Node Title** `first8hex`. NEVER put full UUIDs in prose — they are implementation details.

**Operational traces**: NEVER expose internal retrieval mechanics. Do not mention failed commands, fallback attempts, retries, or session/cache state ("Already in context", "No traversal needed"). Present results as if retrieval was seamless.

**Prefix IDs**: `ikai traverse` and its subcommands (`parents`, `children`, `tree`, `explain`, `context`) accept prefix IDs (e.g. `d6d7b833` instead of the full UUID). The CLI resolves the prefix automatically. If the prefix is ambiguous, the CLI returns `AMBIGUOUS_PREFIX` — provide more characters.

**`ikai search` flags**: `ikai search` accepts `--namespace <ns>` as a client-side post-filter. It searches all namespaces by default and filters results after retrieval.

- **Skipping `ikai render --all` after ingest**: The wiki is stale until render runs. Always run `ikai render --all --namespace <ns>` before reporting to the developer or reading `~/.ikai-data/log.md`.
- **Running `ikai render` before resolving all dedup candidates**: If any candidate was left undecided, the graph may contain duplicate nodes. Complete dedup review first.
- **Confusing "supporting reference" skills**: The `ingest-pipeline` skill describes the TypeScript source code internals. This skill (`ikai-ingest-workflow`) describes the operational workflow. They are different.
- **Missing the namespace mount check**: `ikai ingest` against an unmounted namespace will fail with an unhelpful error. Always verify with `ikai graph --status --namespace <ns>` first.
- **Uppercase in namespace**: Namespaces must be lowercase (`@owner/project`). `@devuser/KarpGist` → `@devuser/karpgist`. The error message now includes the corrected form.
- **Forgetting `--extracted`**: `ikai ingest` will refuse without `--extracted`. The agent must generate the extraction JSON (Step 1) before running the CLI.
- **Trying to add cross-graph connections during ingest**: Ingest only processes the document itself. Use `ikai-connect-workflow` after ingest to link the new nodes into the broader graph.
- **Skipping sections**: Every heading-delimited section MUST become a node. Do not omit sections that seem short or unimportant — completeness is the invariant.
- **Using invalid edge types**: Valid edge types are `contradicts | supports | defines | extends | derived_from | mentions | proposes_change_to`. Do not use `related_to` or `part_of` — the CLI will reject them with `VALIDATION_ERROR`.
