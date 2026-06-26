---
name: "graph-traversal"
description: "Supporting reference skill. REQUIRED when implementing or debugging graph traversal code in packages/cli/src/graph/. Triggers: ikai traverse, bfs, dfs, khop, k-hop, shortest-path, topo-sort, cycles, adjacency, TraversalNode, AdjacencyList, packages/cli/src/graph/. Do not use this skill for operational ikai workflows — use ikai-ingest-workflow, ikai-query-workflow, or ikai-maintenance-workflow instead."
---

# Graph Traversal Skill

## When This Skill Applies

**USE FOR:**
- Implementing or debugging traversal algorithms in `packages/cli/src/graph/` (bfs.ts, dfs.ts, khop.ts, shortest-path.ts, topo-sort.ts, cycles.ts)
- Working with the `ikai traverse` command or its sub-options (`--bfs`, `--dfs`, `--khop`, `--path`, `--cycles`)
- Building or consuming `AdjacencyList` or `TraversalNode` types
- Working with `packages/cli/src/commands/traverse.ts`
- Reasoning about graph depth, direction (inbound/outbound/both), or reachability

**DO NOT USE FOR:**
- Graph store mutations — use `ikai add`, `ikai update`, `ikai remove` (different domain)
- Ingest pipeline processing (`packages/cli/src/ingest/`) — use the ingest-pipeline skill
- Lint analysis (`packages/cli/src/lint/`) — backlink, orphan, stale checks
- Cloud API or Supabase schema changes

## Core Knowledge

### Architecture: AdjacencyList as the Core Primitive

All traversal algorithms in ikai operate on an in-memory `AdjacencyList` — not the raw graph store. The adjacency list is built once from a store query and passed to the algorithm. This separation is critical:

```
Store → buildAdjacencyList() → AdjacencyList → bfs() / dfs() / khop() / etc.
```

**`AdjacencyList` shape** (from `packages/cli/src/graph/adjacency.ts`):
```typescript
interface AdjacencyList {
  nodeMap: Map<string, Node>;     // node id → Node
  outEdges: Map<string, Edge[]>;  // node id → edges where from_node === id
  inEdges:  Map<string, Edge[]>;  // node id → edges where to_node === id
}
```

Do NOT pass raw Node arrays or Edge arrays to traversal functions. Always build the `AdjacencyList` first.

### TraversalNode vs Node

Traversal functions return `TraversalNode[]`, not `Node[]`. `TraversalNode` is a projection:
```typescript
interface TraversalNode {
  id: string;
  title: string;
  type: string;
  namespace: string;
  hop: number;   // distance from start node
}
```

The `hop` field is zero for the start node and increments per traversal step. Use it for depth-first rendering, hop-labelled output, and depth-bounded queries.

### Direction Parameter

All algorithms accept a `direction` parameter with three values:
- `'outbound'` — follow `from_node → to_node` edges only
- `'inbound'` — follow edges arriving at the current node only
- `'both'` *(default)* — follow edges in either direction

**Warning**: `'both'` on a dense graph with low `maxDepth` can still be expensive. When a user asks for "dependencies of X", use `'outbound'`. For "what depends on X", use `'inbound'`.

### Algorithm Selection Guide

#### Traversal (in `packages/cli/src/graph/`)

| Goal | Algorithm | File | CLI flag |
|---|---|---|---|
| Enumerate all reachable nodes layer by layer | `bfs()` | bfs.ts | `--algo bfs` |
| Deep-first path exploration, pre-order | `dfs()` | dfs.ts | `--algo dfs` |
| All nodes within exactly k hops (frontier-based) | `khop()` | khop.ts | `--algo khop` |
| Shortest hop-distance between two nodes | `shortestPath()` | shortest-path.ts | `--algo shortest-path` |
| Shortest path weighted by edge.weight (inverted as cost) | `dijkstra()` | dijkstra.ts | `--algo dijkstra --to <id>` |
| All simple paths between two nodes, ranked by weight | `allSimplePaths()` | all-paths.ts | `--algo all-paths --to <id>` |
| Lowest common ancestors of two nodes (inbound BFS) | `lowestCommonAncestors()` | lca.ts | `--algo lca --to <id>` |
| Check if B is reachable from A + hop distance | `reachability()` | reachability.ts | `--algo reachable --to <id>` |
| Connected components on undirected projection | `connectedComponents()` | connected-components.ts | `ikai analyse --algo components` |
| Linear ordering respecting all edges | `topoSort()` | topo-sort.ts | `ikai analyse --algo topo` |
| Detect back-edges in directed graph | `detectCycles()` | cycles.ts | `ikai analyse --algo cycles` |

#### Analysis (in `packages/cli/src/analysis/`)

| Goal | Algorithm | File | CLI flag |
|---|---|---|---|
| Node importance score (propagated via in-links) | `computePageRank()` | pagerank.ts | `ikai analyse --algo pagerank` |
| Fraction of shortest paths running through a node | `computeBetweenness()` | betweenness.ts | `ikai analyse --algo betweenness` |
| How close a node is to all other reachable nodes | `computeCloseness()` | closeness.ts | `ikai analyse --algo closeness` |
| Degree distribution and per-node in/out counts | `computeDegreeDistribution()` | degree.ts | `ikai analyse --algo degree` |
| Community/cluster membership (Louvain) | `detectCommunities()` | community.ts | `ikai analyse --algo community` |
| Strongly connected components (Tarjan) | `findSCCs()` | scc.ts | `ikai analyse --algo scc` |
| Nodes whose removal disconnects the graph | `findArticulationPoints()` | articulation.ts | `ikai analyse --algo articulation` |
| Edges whose removal disconnects the graph | `findBridges()` | bridges.ts | `ikai analyse --algo bridges` |
| Predict missing edges by common-neighbor count | `predictLinks()` | link-prediction.ts | `ikai analyse --algo link-predict` |
| Predict missing edges by Jaccard coefficient | `jaccardLinkPrediction()` | link-metrics.ts | `ikai analyse --algo link-predict-jaccard` |
| Predict missing edges by Adamic-Adar score | `adamicAdarLinkPrediction()` | link-metrics.ts | `ikai analyse --algo link-predict-adamic` |
| Overall graph statistics (density, type dist.) | `computeGraphStats()` | stats.ts | `ikai analyse --algo stats` |

### Patterns & Best Practices

- **Always pass `maxDepth` explicitly** — defaults to `3` for bfs/dfs, `2` for khop. These are sensible defaults for interactive use but can be surprising in batch jobs or large graphs.
- **`khop()` vs `bfs()`** — khop expands an entire frontier per hop (all neighbours at distance k simultaneously). bfs is queue-based and visits nodes strictly in hop order. Both produce `hop`-annotated results; prefer `bfs` when you need guaranteed BFS ordering for streaming output, `khop` when you need clean "all nodes at exactly distance k" semantics.
- **De-duplicate edges** — All algorithms track a `Set<string>` of edge IDs to avoid returning duplicate edges when both outbound and inbound traversal visit the same edge.
- **The adjacency list is immutable during traversal** — Do not mutate the adjacency list inside a traversal function. Build a new one from the store if the graph changes.
- **`shortestPath()` returns `null` when no path exists** — always null-check the return value before accessing `.path` or `.hops`.

### Worked Examples

**Example 1 — BFS from a node, 2 hops outbound**

```typescript
import { buildAdjacencyList } from '../graph/adjacency.js';
import { bfs } from '../graph/bfs.js';

// Build once per command invocation
const adj = buildAdjacencyList(nodes, edges);

// Traverse outbound, max 2 hops
const { nodes: resultNodes, edges: resultEdges } = bfs(adj, startNodeId, 2, 'outbound');

// resultNodes includes the start node at hop=0
// each subsequent hop increments the hop counter
```

_Why this works_: The adjacency list pre-indexes both outbound and inbound edges by node ID, making neighbour lookups O(1). Passing `'outbound'` means only `adj.outEdges` is consulted — equivalent to "what does this node point to."

**Example 2 — K-hop expansion for context window**

```typescript
import { khop } from '../graph/khop.js';

// Get all nodes within 2 hops (all directions)
const { nodes: contextNodes } = khop(adj, focalNodeId, 2);

// contextNodes[0] is always the focal node (hop=0)
// useful for building agent context windows from a selected node
```

_Why this works_: `khop()` uses a frontier set per hop, ensuring every node at exactly distance k is included before moving to k+1. This gives clean "neighbourhood rings" ideal for context-window assembly.

**Example 3 — Shortest path for traversal explanation**

```typescript
import { shortestPath } from '../graph/shortest-path.js';

const result = shortestPath(adj, fromId, toId);
if (result === null) {
  console.log('No path exists between these nodes.');
} else {
  console.log(`Shortest path: ${result.path.map(n => n.title).join(' → ')} (${result.hops} hops)`);
}
```

## Edge Cases

- **Self-loop**: An edge where `from_node === to_node`. The `visited` set prevents infinite loops by marking a node before recurring, but the self-loop edge will appear in `resultEdges`. Do not treat self-loops as errors — they are valid in ikai's knowledge model (a node can reference itself).
- **Disconnected nodes**: If `startId` is not in `adj.nodeMap`, all algorithms return `{ nodes: [], edges: [] }` silently. The traverse command formats this as "Node not found" before calling the algorithm; do not swallow this silently in lower layers.
- **`maxDepth = 0`**: Returns only the start node itself (hop=0) with no edges. Valid for single-node "context" queries. BFS and DFS both handle this correctly by checking `current.hop >= maxDepth` before enqueueing neighbours.
- **Bidirectional edge traversal duplication**: When `direction = 'both'`, an edge between A and B may be encountered twice (once from A's outEdges and once from B's inEdges). All algorithms deduplicate via `edgeSet` — the edge appears exactly once in `resultEdges`.
- **Very large graphs** (`maxDepth` uncapped): The store limits namespace size but there is no algorithm-level node count cap. Always apply a reasonable `maxDepth` (≤5) to avoid O(n) scans over the full namespace graph.

## Common Pitfalls

- **Using `updated_at` instead of `last_confirmed_at` for staleness** — stale detection uses `last_confirmed_at` (`packages/cli/src/lint/stale.ts`). These are different timestamps. `updated_at` reflects any field change; `last_confirmed_at` reflects when a human or agent explicitly confirmed the node's accuracy.
- **Building adjacency from stale local cache** — if you build the adjacency list from a stale graph.json and the projection is not synced, traversal will miss nodes added since last sync. Always run `ikai lint --sync` before traversal in CI contexts.
- **Passing `direction = 'both'` when the user asked for "dependencies"** — "what depends on X" is `'inbound'`, "what X depends on" is `'outbound'`. Using `'both'` returns the full neighbourhood rather than a directional dependency chain.
