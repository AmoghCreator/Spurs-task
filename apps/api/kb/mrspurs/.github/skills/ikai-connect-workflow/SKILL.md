---
name: ikai-connect-workflow
description: "REQUIRED for finding and creating connections between nodes in the ikai knowledge graph. Use after ingest to link new nodes into the existing graph, or on demand to discover missed connections. Triggers: ikai connect, connect nodes, find connections, link documents, cast the net, cross-namespace connections, connect these documents, relate nodes. Excludes ingest (document processing), query (answering questions), and structural health checks (stale/orphan/backlink)."
---

# ikai Connect Workflow Skill

## When This Skill Applies

**USE FOR:**
- After an ingest session, linking newly ingested nodes into the existing graph
- Developer asks to "find connections", "link up the graph", "cast the net", "connect these documents"
- Discovering missed semantic links within a namespace
- Expanding connection search across namespaces (with user confirmation)
- Connecting only user-specified documents while ignoring everything else
- Any phrase like "connect nodes", "relate these", "find what links to this", "what connections am I missing"

**DO NOT USE FOR:**
- Processing/extracting a source document (use `ikai-ingest-workflow`)
- Answering questions from the graph (use `ikai-query-workflow`)
- Structural health checks: stale nodes, orphans, missing backlinks, transitive reduction (use `ikai-maintenance-workflow`)
- Debugging connection-finding source code (use `ingest-pipeline` skill)

## Core Knowledge

### Design Principles

1. **Title-first** — Work with node titles, not UUIDs. Use `ikai resolve` to get short IDs when needed for commands.
2. **Use `--llm` everywhere** — All CLI commands support `--llm` for compact, title-centric output. Always use it.
3. **Iterative, not bulk** — Present candidates in batches of ~10. Do not dump 30 candidates at once.
4. **Quality over quantity** — A single high-confidence `extends` edge is worth more than five weak `mentions` edges.

### Connection Modes

The connect workflow supports five modes. The agent MUST present these options to the developer and let them choose. Do not guess.

| # | Mode | What it finds | Predictor strategy |
|---|------|--------------|-------------------|
| 1 | **Within a document** | Missed semantic edges between nodes from the same source document | Structural: `link-predict`, `link-predict-jaccard`, `link-predict-adamic` |
| 2 | **Between all documents in namespace** | Inter-document edges only (same-source pairs excluded automatically) | Content-based: `link-predict-content` only |
| 3 | **Between specific documents** | Crossing edges between exactly the named documents (A→B, B→A only; not A→A or B→B) | Content-based: `link-predict-content`, post-filtered |
| 4 | **Between a document and a namespace** | Edges from one document's nodes to all nodes in a target namespace | Content-based: `link-predict-content`, post-filtered |
| 5 | **Between namespaces** | Cross-namespace connections spanning multiple namespaces | Content-based: `ikai search` + `link-predict-content` |

**Why structural vs content-based matters:**
- Structural predictors (common-neighbor, Jaccard, Adamic-Adar) require shared graph neighbors. They work within a document's cluster but are **blind across disconnected clusters** (different documents). Never use them for cross-document discovery.
- Content-based prediction (`link-predict-content`) compares word sets. It works across disconnected clusters and automatically excludes same-source pairs. Use it for all cross-document modes.

### The Connect Loop (Step-by-Step)

**Step 0 — Detect the active namespace (MANDATORY — do not skip)**

Before doing anything else, determine the active namespace from the workspace. Read `.ikai/config.yaml` in the current workspace root (or walk up the directory tree to find it). The `namespace:` field is the active namespace.

```bash
# Read .ikai/config.yaml from the workspace root — no CLI command needed, just read the file
# Example content:
# namespace: @devuser/karpgist   ← this is the active namespace
# mount_namespaces: []
# readonly_namespaces: []
```

**Never guess or invent the namespace. Never default to `@owner/project`.** If `.ikai/config.yaml` is missing, ask the developer to run `ikai init <name>` first.

**Step 1 — Present mode options and let the developer choose**

Always present the options explicitly. Do not infer the mode silently.

> "How should I search for connections?
> 1. **Within a document** — find missed semantic links inside a single document
> 2. **Between all documents** — find inter-document connections across the namespace
> 3. **Between specific documents** — connect only the documents you name
> 4. **From a document to a namespace** — connect one document to everything in a namespace
> 5. **Between namespaces** — search across your mounted/readonly namespaces"

If the developer's request already makes the mode obvious (e.g. "connect doc A and doc B" → mode 3, "find connections in the namespace" → mode 2), confirm the mode in one line and proceed. Only show the full menu when ambiguous.

**Step 2 — Gather candidates (mode-specific)**

#### Mode 1: Within a document

The developer names a specific document. Find missed semantic edges between that document's nodes.

1. **List available documents** and let the developer pick which one:
   ```bash
   ikai sources --namespace <ns> --llm
   ```
   Present the list and ask which document to search within.

2. Run **structural** predictors (these work within a connected cluster):
   ```bash
   ikai analyse --namespace <ns> --algo link-predict --limit 20 --llm
   ikai analyse --namespace <ns> --algo link-predict-jaccard --limit 20 --llm
   ikai analyse --namespace <ns> --algo link-predict-adamic --limit 20 --llm
   ```

3. **Post-filter**: Keep only pairs where BOTH nodes have the same source in their `sources` field matching the specified document. Discard all other candidates.

   To check which source a node belongs to, read the node's `.md` file frontmatter — the `sources:` field lists the source file paths (e.g. `.ikai/sources/my-paper.md`).

#### Mode 2: Between all documents in namespace

Default post-ingest mode. Finds inter-document connections only.

```bash
ikai analyse --namespace <ns> --algo link-predict-content --limit 30 --llm
```

`link-predict-content` **automatically excludes same-source pairs**. Every result is a cross-document connection. No post-filtering needed.

Do NOT run structural predictors for this mode — they cannot find cross-cluster links.

#### Mode 3: Between specific documents

The developer names exactly which documents to connect (e.g., "connect paper-A and paper-B").

1. If the developer hasn't named specific documents, **list available documents** and let them choose:
   ```bash
   ikai sources --namespace <ns> --llm
   ```

2. Identify each document's source path. Resolve if needed:
   ```bash
   ikai resolve "<document title>" --llm
   ```
   Then read the resolved node's frontmatter to get its `sources:` value.

2. Run content-based prediction on the full namespace:
   ```bash
   ikai analyse --namespace <ns> --algo link-predict-content --limit 30 --llm
   ```

3. **Post-filter**: Keep only pairs where the two nodes come from **different** specified documents. For example, if the developer names doc A and doc B, keep only pairs where one node's source is doc A and the other's is doc B. Discard pairs where both are from doc A or both from doc B.

#### Mode 4: From a document to a namespace

The developer names one document and a target namespace. Find edges from that document's nodes to all nodes in the target namespace.

1. **List available namespaces** so you can confirm valid targets:
   ```bash
   ikai namespaces --json
   ```

2. **List available documents** in both the source and target namespace:
   ```bash
   ikai sources --namespace <source-ns> --llm
   ikai sources --namespace <target-ns> --llm
   ```

3. Identify the document's source path. Resolve if needed:
   ```bash
   ikai resolve "<document title>" --llm
   ```
   Then read the resolved node's frontmatter to get its `sources:` value.

4. Run content-based prediction on the target namespace:
   ```bash
   ikai analyse --namespace <target-ns> --algo link-predict-content --limit 30 --llm
   ```

5. **Post-filter**: Keep only pairs where at least one node belongs to the specified document (has the document's source in its `sources` field). Since `link-predict-content` already excludes same-source pairs, results involving the specified document's nodes will connect to nodes from other documents.

   If the target namespace is different from the document's namespace, use `ikai search` with keywords extracted from the document's nodes to find candidates across namespaces (see mode 5 pattern).

#### Mode 5: Between namespaces

The developer wants cross-namespace connections.

1. **List all available namespaces** and present them to the developer:
   ```bash
   ikai namespaces --json
   ```
   Show the namespace list and ask which namespaces to connect, unless the developer has already specified.

2. **List documents in each target namespace** so the developer knows what's available:
   ```bash
   ikai sources --namespace <ns1> --llm
   ikai sources --namespace <ns2> --llm
   ```

3. First run mode 2 within the active namespace and present results.

4. Then prompt:
   > "I found [N] potential connections within `<ns>`. Want me to also search across your other namespaces?"

5. If confirmed, extract 3–8 high-signal keywords from recently ingested or high-pagerank nodes and run:
   ```bash
   ikai search "<keyword>" --json
   # Results span ALL namespaces. Filter to exclude the active namespace.
   ```

6. For each cross-namespace match that is meaningfully related, propose a cross-graph edge.

**Step 3 — Classify and present candidates**

For each candidate connection, read both node bodies and choose the most semantically precise edge type:

| If the relationship is... | Use |
|--------------------------|-----|
| A is a specific example / instance of B | `extends` |
| A provides evidence that B is true | `supports` |
| A was built from / derived from the ideas in B | `derived_from` |
| A gives the technical definition of B | `defines` |
| A references B in passing, without strong dependency | `mentions` |
| A says something that conflicts with B | `contradicts` |

**Interpretation guide for content-based scores (modes 2–5):**

Same-source pairs are automatically excluded by the algorithm. All results are
cross-document connections. Cross-document scores are naturally lower than
within-document scores because different documents use different vocabulary.

| Score range | Signal strength | Action |
|-------------|----------------|--------|
| ≥ 0.15 | Strong — likely a genuinely missing edge | Present with high confidence |
| 0.06–0.14 | Moderate — review shared terms carefully | Present with justification from shared terms |
| 0.03–0.05 | Cross-document signal — shared domain terms | Present if shared terms are domain-specific (not just function words) |
| < 0.03 | Weak — likely noise | Skip unless shared terms are highly specific |

**Interpretation guide for structural scores (mode 1 — within-document):**

| Predictor | Surface if score ≥ | Notes |
|-----------|-------------------|-------|
| `link-predict` | 2 common neighbors | High — nodes share multiple neighbors |
| `link-predict-jaccard` | 0.15 | Normalized by neighborhood size |
| `link-predict-adamic` | 0.30 | Penalizes high-degree hubs |

Present candidates grouped by confidence:

> **High confidence:**
> - **Node A** `prefix01` → **Node B** `prefix02` — `supports` — "Both discuss X; A provides empirical evidence for B's theoretical claim"
>
> **Moderate:**
> - **Node C** `prefix03` → **Node D** `prefix04` — `extends` — "C specializes the general framework described in D"

**Step 4 — Enrichment candidates (node body updates)**

While searching for connections, if a new node covers the same concept as an existing node but adds meaningfully new information (new evidence, different framing, concrete example, updated data):

1. Read the existing node's body
2. Propose a merged body that integrates old and new knowledge
3. Present to the developer:
   > "**Existing node**: **[title]** `[prefix]` — current body covers X.
   > **New information from [source]**: adds Y.
   > **Proposed merged body**: [merged text]
   > Accept this update?"

On confirmation:
```bash
ikai update node <existing-id> --body "<merged body>"
```

**Step 5 — Apply confirmed connections**

After the developer confirms which edges to add, apply them one at a time:

```bash
ikai add edge --from <node-a-id> --to <node-b-id> --type <edge-type>
```

> **`ikai add edge` does NOT accept a `--namespace` flag.** The namespace is inferred from the node IDs.

> **`related_to` is NOT a valid edge type.** Use `supports` or `mentions` for generic conceptual linkages.

> **Cross-namespace edges are valid.** `ikai add edge` handles cross-namespace edges correctly as long as both node IDs are valid.

**Step 6 — Re-render**

```bash
ikai render --namespace <ns>
```

If cross-namespace edges were added, also render the other affected namespaces.

**Step 7 — Report**

Summarise what was connected:

> "Connect complete. Scanned [N] node pairs → [M] connections added ([K] within namespace, [J] cross-namespace). [P] node bodies enriched. [Q] candidates skipped."

### When to Suggest Connect After Ingest

After any ingest session, the agent SHOULD suggest running connect:

> "Ingest complete. [N] nodes added. Want me to find connections between these new nodes and the rest of your graph?"

This is a suggestion, not automatic. The developer may decline if they plan to ingest more documents first and connect later.

## Edge Cases

- **Empty namespace (first ingest)**: If the namespace has fewer than 5 nodes, link prediction will return few or no results. Inform the developer: "The graph is still small — connection discovery works best with more ingested content. Consider running connect again after your next few ingests."

- **Single document in namespace**: Mode 2 (between all documents) requires at least 2 documents. If only 1 exists, tell the developer: "Only one document in this namespace — inter-document connections need at least two ingested sources. Use mode 1 (within document) instead, or ingest another source first."

- **Specified documents share no connections (mode 3)**: If all scores < 0.03, say so clearly: "No meaningful connections found between [Doc A] and [Doc B]. The documents cover distinct topics with no semantic overlap."

- **Too many candidates**: If link prediction returns more than 20 candidates above threshold, batch them. Present the top 10 highest-scoring first, then ask: "There are [N] more candidates. Want to see the next batch?"

- **Cross-namespace permission**: The developer may have `readonly_namespaces` in their config. Edges *from* a readonly namespace node *to* the active namespace are valid (they're stored in the active namespace's edge table). But edges *to* a readonly namespace node require write access. Check and warn if needed.

- **Contradictory nodes found during connect**: If two nodes make conflicting claims, surface both:
  > "Found a contradiction: **[Claim A]** `prefix01` vs **[Claim B]** `prefix02`. Would you like to add a `contradicts` edge between them?"

- **Mode confusion**: If the developer says "connect" after ingest without specifying — present the mode menu. Do not default to any mode silently.

## Command Reference (Connect-Relevant)

### Namespace and document discovery

```bash
ikai namespaces --json                # list all local + remote namespaces with paths and access level
ikai sources --namespace <ns> --llm   # list all ingested source documents in a namespace (with node counts per source)
```

Use `ikai namespaces` at the start of modes 4 and 5 to show available namespaces.
Use `ikai sources` to show available documents within any namespace — essential for modes 1, 3, and 4.

### Search (cross-graph / cross-namespace)

```bash
ikai search "<keyword>" --llm          # searches ALL namespaces
ikai search "<keyword>" --namespace <ns> --llm  # client-side post-filter to one namespace
ikai search "<keyword>" --limit <n> --llm     # default 30, max 100
```

### Title-to-ID resolution

```bash
ikai resolve "<node title>" --llm     # fuzzy match, returns top 5 with short IDs
ikai resolve "<node title>" --exact --llm  # case-insensitive exact match
```

### Link prediction

```bash
ikai analyse --namespace <ns> --algo link-predict-content --limit 30 --llm
# Content-based: Jaccard similarity on title+body word sets. Best for cross-cluster links.

ikai analyse --namespace <ns> --algo link-predict --limit 20 --llm
# Structural: common-neighbor score. Best for within-cluster gaps.

ikai analyse --namespace <ns> --algo components --llm
# Shows connected components — useful to identify disconnected clusters before connecting.
```

### Edge mutations

```bash
ikai add edge --from <id> --to <id> --type <edge-type>
# Does NOT accept --namespace. Namespace inferred from node IDs.
# Valid types: contradicts | supports | defines | extends | derived_from | mentions | proposes_change_to
```

### Node updates (enrichment)

```bash
ikai update node <id> --body "<new body>"
```

### Traversal (for document-pair mode neighbourhood inspection)

```bash
ikai traverse <short-id> --algo bfs --depth 1 --llm
ikai traverse <id-a> --algo shortest-path --to <id-b> --llm
```

## Common Pitfalls

- **Using `related_to` as an edge type**: Not valid. The CLI rejects it with `VALIDATION_ERROR`. Use `supports` or `mentions` for generic links.
- **Adding edges without developer confirmation**: The connect workflow is advisory. Every edge must be confirmed before creation.
- **Running connect before ingest finishes**: If ingest is still in progress, the graph is in a partial state. Always wait for ingest to complete.
- **Ignoring enrichment opportunities**: If a new node essentially restates an existing node with added information, the right action is to update the existing node — not just add an edge. Always check for enrichment, not just connections.
- **Using structural predictors for cross-document modes**: Structural predictors (link-predict, jaccard, adamic-adar) require shared neighbors. Different documents form disconnected clusters with zero common neighbors. These predictors return nothing useful across documents. Use `link-predict-content` for modes 2–5.
- **Using content-based prediction for within-document mode**: `link-predict-content` automatically excludes same-source pairs, so it returns zero results for within-document searches. Use structural predictors for mode 1.
- **Skipping the mode menu**: Always present the mode options or confirm the inferred mode. Silently choosing the wrong mode wastes the developer's time.
- **Flooding the developer with weak candidates**: For cross-doc modes, score < 0.03 is noise. For within-doc (structural), only surface candidates above the thresholds in the interpretation guide.

### Shared Formatting Rules (all ikai workflows)

**Citation format**: When referencing a node in output to the developer, use the node title in bold with the first 8 hex chars of the UUID in backticks: **Node Title** `first8hex`. NEVER put full UUIDs in prose.

**Prefix IDs**: CLI commands accept prefix IDs (e.g. `d6d7b833` instead of the full UUID). If ambiguous, the CLI returns `AMBIGUOUS_PREFIX` — provide more characters.
