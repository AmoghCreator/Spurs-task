---
name: "ingest-pipeline"
description: "Supporting reference skill. REQUIRED when implementing or debugging ingest pipeline code in packages/cli/src/ingest/ or lint code in packages/cli/src/lint/. Triggers: ikai ingest, dedup, source-store, stale, backlinks, orphans, transitive-reduction, packages/cli/src/ingest/, packages/cli/src/lint/, RawSource, content_hash, computeTitleSimilarity. Do not use this skill for operational ikai workflows — use ikai-ingest-workflow or ikai-maintenance-workflow instead."
---

# Ingest Pipeline Skill

## When This Skill Applies

**USE FOR:**
- Implementing or debugging the `ikai ingest` command (`packages/cli/src/commands/ingest.ts`)
- Working with deduplication logic in `packages/cli/src/ingest/dedup.ts`
- Working with source storage in `packages/cli/src/ingest/source-store.ts`
- Working with lint checks in `packages/cli/src/lint/` (stale.ts, backlinks.ts, orphans.ts, transitive-reduction.ts)
- Reasoning about `RawSource`, content hash dedup, or title similarity scoring
- Working with the `ikai lint` command (`packages/cli/src/commands/lint.ts`)

**DO NOT USE FOR:**
- Graph traversal algorithms (use the graph-traversal skill)
- Cloud API schema migrations (`packages/cloud-api/migrations/`)
- Authentication or namespace authority enforcement (`packages/cli/src/auth/`)
- VS Code extension code

## Core Knowledge

### Pipeline Architecture

The ingest pipeline processes a raw source file (Markdown, plain text, or structured data) into graph nodes and edges. It follows a linear pipeline:

```
Raw file → storeRawSource() → dedup check → parse → add/update nodes → lint
```

**Key invariants**:
1. A raw source is content-hash deduped before any parsing occurs (`source-store.ts`).
2. Nodes are title-similarity deduped against existing namespace nodes before creation (`dedup.ts`).
3. Lint checks run after ingest to surface quality issues — they do not block ingest.
4. All writes go through the `StoreRouter` (the CLI store layer) — the pipeline never writes to DuckDB or Supabase directly.

### Two-Layer Deduplication

The ingest pipeline uses two independent dedup mechanisms:

**Layer 1 — Content hash dedup** (`source-store.ts`):
- SHA-256 hash of the raw file bytes
- If the hash already exists in `raw_sources`, the file is a duplicate and ingest returns `was_duplicate: true` without processing the file again
- This is a binary yes/no check — no partial match

**Layer 2 — Title similarity dedup** (`dedup.ts`):
- Jaccard similarity on normalised word sets of the proposed node title vs. all existing nodes in the namespace
- Default threshold: **0.5** (configurable)
- If one or more candidates exceed the threshold, the CLI prompts the user to review before creating a new node
- This prevents near-duplicate nodes (e.g., "Graph Theory" and "Graph Theories") from accumulating

```typescript
// Jaccard formula used:
// similarity = |words(A) ∩ words(B)| / |words(A) ∪ words(B)|
```

### Staleness Model

Stale detection uses **confidence decay** (`packages/cli/src/lint/stale.ts`):

```
confidence(t) = base_confidence × 0.95^(days_since_last_confirmed / 30)
```

Key points:
- The decay uses `last_confirmed_at`, **not** `updated_at`. These are different timestamps.
- `last_confirmed_at` is updated only when a human or agent explicitly confirms a node's accuracy (via `ikai update --confirm`).
- Default stale threshold: **0.3** (confidence below 0.3 → node flagged as stale).
- Stale nodes are surfaced by `ikai lint --stale` — they are never auto-deleted.

### Lint Checks Overview

| Check | File | What it detects |
|---|---|---|
| Stale nodes | stale.ts | Confidence-decayed below threshold |
| Missing backlinks | backlinks.ts | Nodes referenced by edges but with no reciprocal reference |
| Orphan nodes | orphans.ts | Nodes with zero edges (no in or out) |
| Transitive reduction | transitive-reduction.ts | Edges that are redundant given other existing paths |

Lint checks are read-only. They report issues but do not mutate the graph.

### Patterns & Best Practices

- **Always check `was_duplicate` after `storeRawSource()`** — if duplicate, return early without parsing. Processing a duplicate source creates redundant nodes.
- **Use the 0.5 similarity threshold as a starting point** — lower thresholds (e.g., 0.3) produce more false positives; higher thresholds (e.g., 0.7) miss more near-duplicates. The default 0.5 balances precision and recall for technical documentation.
- **DO NOT use `updated_at` for decay calculations** — only `last_confirmed_at`. This is the most common mistake when extending the stale detection logic.
- **Lint is advisory, not blocking** — lint issues should be surfaced to the user but must never prevent a successful ingest from completing. Wrap lint calls in try/catch and log warnings on failure.
- **Title normalisation is case-insensitive and strips punctuation** — "Graph Theory" and "graph theory!" have similarity 1.0. Rely on the `normalize()` helper inside `dedup.ts` rather than re-implementing it.

### Worked Examples

**Example 1 — Content hash dedup check before processing**

```typescript
import { storeRawSource } from '../ingest/source-store.js';

const result = await storeRawSource(store, '/path/to/doc.md', '@alice/frontend', 'alice');

if (result.was_duplicate) {
  console.log(`Skipping duplicate source (hash already stored): ${result.source.content_hash}`);
  return;
}

// Safe to parse and ingest
console.log(`New source stored: ${result.source.filename}`);
```

_Why this works_: SHA-256 is collision-resistant at this scale. Computing the hash before any parsing avoids loading the file contents into the parse pipeline unnecessarily for duplicates.

**Example 2 — Title similarity check before node creation**

```typescript
import { findDedupCandidates } from '../ingest/dedup.js';

const candidates = await findDedupCandidates(
  '@alice/frontend',
  'React Hook Patterns',
  existingNodes,
  0.5, // default threshold
);

if (candidates.length > 0) {
  console.log('Potential duplicates found:');
  for (const c of candidates) {
    console.log(`  ${c.existing_title} (similarity: ${c.similarity.toFixed(2)})`);
  }
  // Prompt user to confirm or merge before creating
} else {
  // Safe to create new node
}
```

_Why this works_: Jaccard on normalised word sets is fast (O(m+n) where m,n = word counts), requiring no embedding model. It works well for technical prose titles where word overlap is the primary similarity signal.

**Example 3 — Detecting stale nodes after a time skip**

```typescript
import { detectStaleNodes, computeDecayedConfidence } from '../lint/stale.js';

const staleNodes = detectStaleNodes(allNamespaceNodes);

for (const stale of staleNodes) {
  console.log(
    `Node ${stale.node_id}: confidence decayed to ${stale.confidence} ` +
    `(${stale.days_since_update} days since last confirmation)`
  );
}
```

## Edge Cases

- **Hash collision (SHA-256)**: Astronomically unlikely but theoretically possible. If a collision occurs, the second file will be treated as a duplicate of the first. The pipeline has no collision-detection mechanism — this is an accepted risk at this scale. Do not add collision-detection without a clear operational need.
- **Slug conflicts during ingest**: If two source files produce nodes with identical titles (and thus identical generated slugs), the second node creation attempt will collide on the `(namespace, title)` unique index. The pipeline must catch this constraint violation and surface it as a user-actionable error, not an internal 500.
- **Empty source file**: `storeRawSource()` will hash an empty file (SHA-256 of zero bytes) and store it successfully. The parse step that follows will produce zero nodes. This is valid — an empty source is a legal ingest operation. Do not special-case it.
- **`last_confirmed_at` in the future**: Can happen if system clocks are skewed or a node is imported from a source with a future timestamp. `computeDecayedConfidence()` will return a value higher than `base_confidence` (positive exponent). Clamp the result to `[0, 1]` if the caller needs a normalised confidence value.
- **Orphan detection after partial ingest**: If ingest is interrupted after some nodes are created but before all edges are written, orphan detection may flag the partially-ingested nodes. Do not special-case orphan detection for in-progress ingests — the user should re-run the ingest to completion and then re-run lint.

## Common Pitfalls

- **Using `updated_at` instead of `last_confirmed_at` in stale decay** — `updated_at` changes on any field edit; `last_confirmed_at` only changes when a human/agent explicitly confirms accuracy. Using `updated_at` makes every edited node appear fresh, defeating stale detection.
- **Calling `findDedupCandidates()` with an empty `existingNodes` array** — returns zero candidates regardless of threshold, silently bypassing dedup. Always pass the full namespace node list from the store, not a partial result.
- **Assuming `storeRawSource()` is idempotent on re-run** — it is for the same byte-for-byte file (same hash → returns `was_duplicate: true`). But if the file content changes between runs (even whitespace), the hash changes and a new `RawSource` record is created. This can accumulate many versions of a frequently-edited document. Use `ikai ingest --replace` to overwrite the existing source record intentionally.
- **Running lint before ingest completes** — lint checks query the graph store; if ingest is still in progress, lint results reflect a partial state. Always lint after a complete ingest run.
