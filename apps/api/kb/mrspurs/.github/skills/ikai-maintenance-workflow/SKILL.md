---
name: ikai-maintenance-workflow
description: "REQUIRED for running an ikai maintenance session. Use when health-checking the graph or resolving stale nodes, orphans, missing backlinks, or transitive redundancy. Triggers: ikai lint, maintenance session, health check, stale nodes, orphan nodes, backlinks, clean up wiki, fix graph, graph health. Excludes ingest loop, query loop, and connection-finding operations (use ikai-connect-workflow for missed links and cross-graph connections)."
---

# ikai Maintenance Workflow Skill

## When This Skill Applies

**USE FOR:**
- Developer asks for a graph health check, wiki cleanup, or lint pass
- Any phrase like "lint the graph", "find stale nodes", "clean up orphans", "check backlinks", "maintenance session", "health check the knowledge base"
- Running `ikai lint` and interpreting its output
- Resolving stale nodes, orphan nodes, missing backlinks, and transitive-redundant edges

**DO NOT USE FOR:**
- Adding new source documents to the knowledge base (use `ikai-ingest-workflow`)
- Answering questions from the graph (use `ikai-query-workflow`)
- Finding missed links, new connections, or cross-graph edges (use `ikai-connect-workflow`)
- Debugging lint source code in `packages/cli/src/lint/` (use `ingest-pipeline` skill)

## Core Knowledge

### Design Principles

1. **Title-first** — Present issues using node titles, not UUIDs. Use `ikai resolve` to look up short IDs when needed.
2. **Use `--llm` everywhere** — All CLI commands support `--llm` for compact output. Always use it.
3. **One issue at a time** — Present, confirm, apply. Do not batch-dump 20 issues. Work through them sequentially.
4. **Quality over quantity** — A thoughtful edge addition is better than mechanically clearing every lint warning.

### The Maintenance Loop (Step-by-Step)

**Step 0 — Detect the active namespace (MANDATORY — do not skip)**

Before doing anything else, determine the active namespace from the workspace. Read `.ikai/config.yaml` in the current workspace root (or walk up the directory tree to find it). The `namespace:` field is the active namespace.

```bash
# Read .ikai/config.yaml from the workspace root — no CLI command needed, just read the file
# Example content:
# mount_namespaces:
#   - @devuser/karpgist   ← this is the active namespace
# readonly_namespaces: []
```

**Never guess or invent the namespace. Never default to `@owner/project`.** If `.ikai/config.yaml` is missing, ask the developer to run `ikai init <name>` in their project directory first.

All subsequent commands that require `--namespace` MUST use the namespace discovered in this step.

**Step 1 — Run the full lint pass**

```bash
ikai lint --namespace <ns> --stale --orphans --backlinks --transitive-reduction --llm
```

This surfaces all four structural issue types in a single pass. Note the **total issue count** — this becomes the baseline for reporting improvement.

> **Missed-link discovery (finding new semantic connections) is NOT part of maintenance.** Use `ikai-connect-workflow` for that. Maintenance handles only structural health issues surfaced by `ikai lint`.

**Step 2 — Present all issues with recommended resolutions**

Present lint issues to the developer. The agent proposes; the developer confirms. **Never apply a graph mutation without explicit developer confirmation.**

See the Resolution Playbook below.

**Step 3 — Apply confirmed resolutions (one at a time)**

After the developer confirms an action, apply it immediately before moving to the next issue. This keeps the graph in a consistent state throughout the session.

**Step 4 — Re-render after all confirmed mutations**

```bash
ikai render --namespace <ns>
```

Run `ikai render` once — after all mutations are applied, not after each one.

**Step 5 — Report improvement**

Re-run lint and compare the new issue count against the baseline:

```bash
ikai lint --namespace <ns> --stale --orphans --backlinks --transitive-reduction --llm
```

Report: "Maintenance complete. [N] lint issues found; [M] resolved; [K] skipped. Issues remaining: [count]. Run `ikai-connect-workflow` to find missed semantic connections."

### Resolution Playbook

| Issue Type | Source | What the Agent Shows | Mutation (on confirmation) |
|------------|--------|---------------------|---------------------------|
| **Stale node** | lint `--stale` | Node title, current confidence score, days since last confirmation, recommended action (confirm/update/remove) | `ikai update node <id> --body "..."` OR `ikai remove node <id>` |
| **Orphan node** | lint `--orphans` | Node title, node type, suggested candidate edges (based on cross-graph search — see details below) | `ikai add edge --from <orphan-id> --to <related-id> --type <edge-type>` |
| **Missing backlink** | lint `--backlinks` | Source node title, target node title, the edge A→B that lacks a B→A reverse; ask developer to confirm bidirectionality — **see cycle guard below** | `ikai add edge --from <lint-to-id> --to <lint-from-id> --type supports` |
| **Transitive redundancy** | lint `--transitive-reduction` | Three nodes A→B, B→C, and the redundant A→C direct edge; recommend removing A→C | `ikai remove edge --from <a-id> --to <c-id>` |

#### Stale Node — Details

A node becomes stale when its confidence score decays below the threshold:
`confidence = initial_confidence × 0.95^(days / 30)` using `last_confirmed_at`.

When presenting a stale node, show:
- Title and namespace
- Current confidence (e.g., 0.43)
- Days since last confirmation (e.g., 74 days)
- Recommended action: "Confirm (run `ikai update` with a fresh body or `--confirm`), update its body if the claim has changed, or remove if it is no longer relevant."

#### Orphan Node — Details

An orphan is a node with no edges to or from any other node. When resolving orphans, the agent MUST search the entire knowledge graph — all namespaces and all users — for candidate connections. Do not limit candidates to the current namespace.

**Procedure for each orphan:**

1. Read the orphan's `title` and `body`.
2. Extract 2–5 high-signal keywords or noun phrases from the title and body (avoid generic words like "data", "model", "system").
3. For each keyword, run:
   ```bash
   ikai search "<keyword>" --llm
   ```
   This returns matching nodes from **all namespaces across the entire database**.
4. From the results, identify 1–3 nodes that are meaningfully related to the orphan. Exclude the orphan itself.
5. For each candidate, decide the most appropriate edge type: `contradicts | supports | defines | extends | derived_from | mentions | proposes_change_to`
6. Present the candidates to the developer:
   > "Orphan: **[orphan title]** `[orphanID]`
   > Suggested connections:
   > - **[candidate title]** `[candidateID]` — `[edge-type]` — [one-sentence justification]"
7. The developer confirms which (if any) edges to add. Then run:
   ```bash
   ikai add edge --from <orphan-id> --to <candidate-id> --type <edge-type>
   ```

> **`related_to` is NOT a valid edge type and will be rejected by the CLI.** Use `supports` or `mentions` for generic conceptual linkages.

> **`ikai add edge` does NOT accept a `--namespace` flag.** The namespace is inferred automatically from the node IDs. Never pass `--namespace` to `ikai add edge`.

> **Cross-namespace edges are valid.** The orphan may live in `@alice/notes` and the candidate in `@bob/research` — `ikai add edge` handles cross-namespace edges correctly as long as both node IDs are valid.

If `ikai search` returns zero relevant results for all keywords, inform the developer: "No cross-graph candidates found for '[orphan title]'. The node may represent a genuinely novel concept — consider adding it manually via `ikai add node` context or leaving it unconnected for now."

> **Missed-link discovery (finding new semantic connections via link prediction) has moved to `ikai-connect-workflow`.** Maintenance only handles structural health issues surfaced by `ikai lint`.

#### Missing Backlink — Details

The backlinks linter inspects every `derived_from` edge and flags `{ from: A, to: B, suggested_type: 'supports' }` when no `supports` or `mentions` edge exists from B back to A.

**Field mapping**: `from` and `to` in a lint result describe the *existing* `derived_from` edge (`A derived_from B`). The new backlink edge must go in the REVERSE direction:

```bash
# Lint result: { from: A, to: B, suggested_type: 'supports' }
# Correct fix — note fields are SWAPPED:
ikai add edge --from B --to A --type supports
# WRONG — same direction as the derived_from, guaranteed to be rejected or meaningless:
# ikai add edge --from A --to B --type supports
```

**Cycle guard (MANDATORY before adding any backlink edge):** Before running the command, check whether an edge already exists from the lint `to` node back toward the lint `from` node — especially another `derived_from`. If `B derived_from A` is already in the graph alongside `A derived_from B`, adding `B supports A` creates a 2-node cycle (`A → B → A`). In that case **do not add the backlink** — surface the contradiction to the developer instead:

> "Nodes '[A]' and '[B]' both have `derived_from` edges pointing at each other. Adding the backlink would create a cycle. Do you want to keep both edges, remove one, or add a `contradicts` edge to mark the conflict?"

### After the Session

- The wiki is now more accurate: stale claims removed or confirmed, orphans connected, backlinks complete, redundant paths pruned.
- `wiki/log.md` will reflect the session after `ikai render` runs.
- The agent MUST NOT edit `wiki/index.md`, `wiki/log.md`, or any `wiki/*.md` directly — only `ikai render` is permitted.

## Edge Cases

- **All nodes are orphans (new namespace / first ingest)**: If the graph has fewer than 5 nodes or was just created, `ikai lint --orphans` will flag every node. This is expected for new namespaces. Skip orphan lint and inform the developer:
  > "The namespace has fewer than 5 nodes — orphan lint is most useful after the graph has grown. Running stale and backlink checks only."
  
  Do not flag every node as an issue requiring immediate action.

- **No issues found**: If `ikai lint` returns zero issues *and* all link-prediction candidates have score < 0.05, report the healthy status and skip `ikai render`. Example:
  > "Graph is healthy: 0 stale nodes, 0 orphans, 0 missing backlinks, 0 transitive-redundant edges, no high-confidence missed links. No maintenance needed."
  If lint is clean but `link-predict-content` returns candidates with score ≥ 0.10, proceed with the missed-link discovery playbook.

- **`link-predict-content` returns nothing**: All pairs already have score < 0.05. This means either the graph is well-connected or all nodes use sufficiently distinct vocabulary. Report: "Content-based link prediction found no high-confidence candidates — graph vocabulary is well-differentiated." Still run the structural predictors.

- **Developer declines all resolutions**: If the developer skips every proposed action, still run `ikai render` if any mutations were applied in earlier issues. If zero mutations were applied, skip render. Report: "0 changes applied — graph state unchanged."

- **Lint output is very large (>50 issues)**: If the lint pass returns a large number of issues, batch them by type rather than presenting all 50 individually. Ask the developer which category to address first. Address that category fully before moving to the next.

- **Stale node with no original source**: If a stale node has no `derived_from` edges pointing to a source node, the agent cannot automatically suggest a "confirm from source" action. Recommend the developer review the body manually and either update it or remove it.

## Common Pitfalls

### Shared Formatting Rules (all ikai workflows)

These rules apply to all user-facing output from any ikai workflow skill.

**Citation format**: When referencing a node in output to the developer, use the node title in bold with the first 8 hex chars of the UUID in backticks: **Node Title** `first8hex`. NEVER put full UUIDs in prose — they are implementation details.

**Operational traces**: NEVER expose internal retrieval mechanics. Do not mention failed commands, fallback attempts, retries, or session/cache state ("Already in context", "No traversal needed"). Present results as if retrieval was seamless.

**Prefix IDs**: `ikai traverse` and its subcommands (`parents`, `children`, `tree`, `explain`, `context`) accept prefix IDs (e.g. `d6d7b833` instead of the full UUID). The CLI resolves the prefix automatically. If the prefix is ambiguous, the CLI returns `AMBIGUOUS_PREFIX` — provide more characters.

**`ikai search` flags**: `ikai search` accepts `--namespace <ns>` as a client-side post-filter. It searches all namespaces by default and filters results after retrieval.

- **Passing `--namespace` to `ikai add edge`**: `ikai add edge` does not accept `--namespace`. The namespace is inferred from the node IDs. Adding `--namespace` will cause the command to error. Never include it.
- **Using `related_to` as an edge type**: `related_to` is not a valid edge type and the CLI will reject it with `VALIDATION_ERROR`. Use `supports` or `mentions` for generic conceptual links. Full valid set: `contradicts | supports | defines | extends | derived_from | mentions | proposes_change_to`.
- **Swapping from/to when fixing missing backlinks**: The backlinks lint result `{ from: A, to: B }` describes the *existing* `derived_from` edge. The fix edge must be `--from B --to A`, not `--from A --to B`. Getting this backwards either duplicates the existing direction or is silently wrong.
- **Adding a backlink that closes a cycle**: If A `derived_from` B and B `derived_from` A both exist, the suggested `B supports A` backlink closes a 2-node cycle. Always check for a reverse `derived_from` before applying a missing-backlink fix — escalate to the developer if one is found.
- **Applying mutations without developer confirmation**: The maintenance loop is proposal-then-confirm. Never call `ikai update`, `ikai add edge`, or `ikai remove edge` until the developer explicitly says yes to that specific action.
- **Running `ikai render` after each mutation**: Run `ikai render` once at the end of the session, not after every `ikai remove` or `ikai add edge`. Intermediate renders produce partial wiki state and add unnecessary latency.
- **Skipping the before/after lint comparison**: Without reporting the starting issue count, the developer cannot see the improvement. Always note the baseline count at Step 1 and compare at Step 5.
- **Treating transitive redundancy as always bad**: Ask before removing. Some A→C edges are intentional shortcuts added by the developer for navigability. Present the finding and let the developer decide.
- **Limiting orphan candidate search to the current namespace**: Orphan resolution MUST use `ikai search` across all namespaces. Limiting to `listNodesByNamespace` or only the mounted namespace will miss the majority of potential connections in a multi-user graph.
- **Skipping `link-predict-content` because "the graph has no orphans"**: Orphans are a structural metric — a node can have edges and still be missing meaningful semantic connections to other parts of the graph. `link-predict-content` is not a substitute for orphan lint; it is a separate, complementary check. Always run both.
- **Using only structural predictors after a multi-document ingest**: Structural predictors (`link-predict`, `link-predict-jaccard`, `link-predict-adamic`) are blind to disconnected clusters. After ingesting papers or documents from different domains, the clusters will have zero common neighbours — structural predictors return nothing useful. `link-predict-content` is the only predictor that works across disconnected components.
- **Accepting every high-score candidate mechanically**: A score ≥ 0.20 is strong evidence, not proof. Always read both node bodies before adding the edge. The score reflects vocabulary overlap — two nodes can share words without sharing meaning (e.g., two nodes both discussing "graph" might be about completely different graph types).
- **Defaulting all content-prediction candidates to `mentions`**: `mentions` is the weakest edge type and loses semantic precision. Read the bodies, identify the actual relationship (`supports`, `extends`, `derived_from`, etc.), and use the specific type. Reserve `mentions` only for genuinely incidental references.

## ikai Command Reference (Maintenance-Relevant)

A quick reference for commands used in the maintenance workflow.

### Lint

```bash
ikai lint --namespace <ns>                               # full lint (all checks)
ikai lint --namespace <ns> --stale                       # stale-node decay check only
ikai lint --namespace <ns> --orphans                     # orphan nodes only
ikai lint --namespace <ns> --backlinks                   # missing backlink check only
ikai lint --namespace <ns> --transitive-reduction        # redundant direct edges only
ikai lint --namespace <ns> --json                        # machine-readable output
# Combine flags freely: --stale --orphans --backlinks --transitive-reduction
```

**Lint issue types returned:**

| `type` field | Meaning | Fields |
|---|---|---|
| `orphan` | Node with no edges in or out | `node_id`, `title`, `suggestion` |
| `stale` | Confidence decayed below threshold | `node_id`, `confidence`, `days_since_update` |
| `cycle` | Strongly connected component with >1 node | `nodes[]` |
| `contradiction` | Edge of type `contradicts` present | `edge_id`, `from`, `to` |
| `missing_backlink` | `derived_from` edge lacks reverse `supports`/`mentions` | `from`, `to`, `suggested_type` |

### Search (to find orphan candidates)

```bash
ikai search "<keyword>" --json          # token-based: matches ANY word in the query
ikai search "<keyword>" --limit <n>     # default limit 30, max 100
# Results span ALL namespaces — do not restrict to current namespace
```

### Link prediction (missed-link discovery)

```bash
# STEP 1: understand graph structure first
ikai analyse --namespace <ns> --algo components --json
  # → how many connected components? if > 1, link-predict-content is mandatory

ikai analyse --namespace <ns> --algo stats --json
  # → node/edge count, density — orient before running heavier algorithms

# STEP 2: content-based prediction (always run — works across disconnected clusters)
ikai analyse --namespace <ns> --algo link-predict-content --limit 20 --json
  # score field: Jaccard coefficient on word sets (0–1)
  # shared_terms: the overlapping vocabulary tokens driving the score
  # Filter: surface candidates with score >= 0.10 to developer

# STEP 3: structural predictors (run if graph is connected or as secondary pass)
ikai analyse --namespace <ns> --algo link-predict --limit 20 --json
  # common-neighbor count; higher = stronger structural signal

ikai analyse --namespace <ns> --algo link-predict-jaccard --limit 20 --json
  # normalised Jaccard on neighbor sets; better than raw count for high-degree nodes

ikai analyse --namespace <ns> --algo link-predict-adamic --limit 20 --json
  # Adamic-Adar; penalises hub bridges — use when hub nodes dominate the graph
```

**Minimum score thresholds for surfacing candidates:**

| Predictor | Surface if score ≥ |
|-----------|-------------------|
| `link-predict-content` | 0.03 (results are cross-document only; same-source pairs excluded) |
| `link-predict` | 2 (≥ 2 common neighbours) |
| `link-predict-jaccard` | 0.15 |
| `link-predict-adamic` | 0.30 |

### Edge mutations

```bash
ikai add edge --from <node-id> --to <node-id> --type <edge-type>
  # NO --namespace flag — namespace is inferred from node IDs
  # Valid types: contradicts | supports | defines | extends | derived_from | mentions | proposes_change_to

ikai remove edge --from <node-id> --to <node-id>    # remove a specific edge
```

### Node mutations

```bash
ikai update node <id> --body "<new body>"    # refresh content (resets stale clock)
ikai update node <id> --confirm              # reset confidence decay without changing body
ikai remove node <id>                        # delete node (use with developer confirmation only)
```

### Render (after mutations)

```bash
ikai render --namespace <ns>     # regenerate affected wiki pages
# Run ONCE at session end — not after every individual mutation
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

