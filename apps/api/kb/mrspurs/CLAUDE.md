# ikai Knowledge Base

This project uses **ikai** — a persistent, compounding knowledge graph operated by an AI agent.

## What ikai Is

ikai implements the LLM Wiki pattern: instead of re-deriving answers from raw documents on every query, the agent incrementally builds and maintains a structured knowledge graph between you and your raw sources. Ingest a new source → the graph grows and links to existing knowledge. Ask a question → the agent traverses the graph and synthesizes a cited answer. The graph keeps getting richer with every source added and every question asked.

## Three-Layer Architecture

| Layer | Location | Managed by |
|-------|----------|------------|
| **Raw sources** | `raw/` | You — immutable after ingest |
| **Graph** | `.ikai/graph.json` + `nodes/*.md` | ikai CLI — all mutations go through CLI commands |
| **Wiki** | `wiki/` | `ikai render` — never hand-edit these files |

> **Core invariant**: `wiki/` is a rendered projection of the graph. Never edit `wiki/index.md`, `wiki/log.md`, or any `wiki/*.md` directly. Use `ikai render` to regenerate from graph state.

## Three Operational Loops

| Loop | When to use | Entry point |
|------|-------------|-------------|
| **Ingest** | Adding a new source document to the knowledge base | `ikai ingest` |
| **Query** | Answering a question from the graph | `ikai traverse` (after reading `wiki/index.md`) |
| **Maintenance** | Health-checking the graph — stale nodes, orphans, missed links | `ikai lint` |

## Navigation Artifact Rule

Before answering any question from the graph, **always read `wiki/index.md` first** to identify which wiki pages and node IDs cover the topic. Starting traversal from a wrong node produces irrelevant results.

## Namespace Detection Rule

Before running any `ikai` command that accepts `--namespace`, read `.ikai/config.yaml` in the workspace root to find the active namespace. Never guess or default to `@owner/project`.

```bash
# .ikai/config.yaml contains the active namespace, e.g.:
# namespace: @yourname/your-project
```

If `.ikai/config.yaml` is missing, run `ikai init <name>` first.

## About This Knowledge Base

<!-- Customize this section to describe your knowledge base's purpose and conventions -->

**Topic**: [describe what you're tracking here]

**Goals**: [what questions you want to answer, what insight you're building toward]

**Conventions**: [any domain-specific extraction rules, preferred node naming, etc.]

<skills>
<skill>
<name>ikai-ingest-workflow</name>
<description>REQUIRED for running an ikai ingest session. Use when adding a source document to the knowledge base. Triggers: ikai ingest, ingest session, add source, process article, add to wiki, add to knowledge base, ingest this file. Excludes query and maintenance operations and ingest code debugging.</description>
<file>.github/skills/ikai-ingest-workflow/SKILL.md</file>
</skill>
<skill>
<name>ikai-query-workflow</name>
<description>REQUIRED for answering questions from the ikai knowledge base. Use when a developer asks a question from the graph. Triggers: ikai traverse, query wiki, what do I know about, search my wiki, find connections, answer from graph, what does the wiki say. Excludes ingest and maintenance operations and graph traversal code debugging.</description>
<file>.github/skills/ikai-query-workflow/SKILL.md</file>
</skill>
<skill>
<name>ikai-maintenance-workflow</name>
<description>REQUIRED for running an ikai maintenance session. Use when health-checking the graph, finding missed links, or resolving stale/orphan/backlink issues. Triggers: ikai lint, ikai analyse link-predict, maintenance session, health check, missed links, find connections, stale nodes, orphan nodes, backlinks, clean up wiki, fix graph, graph health. Excludes ingest loop and query loop operations.</description>
<file>.github/skills/ikai-maintenance-workflow/SKILL.md</file>
</skill>
<skill>
<name>graph-traversal</name>
<description>Supporting reference skill. REQUIRED when implementing or debugging graph traversal code in packages/cli/src/graph/. Triggers: ikai traverse, bfs, dfs, khop, k-hop, shortest-path, topo-sort, cycles, adjacency, TraversalNode, AdjacencyList, packages/cli/src/graph/. Do not use for operational ikai workflows.</description>
<file>.github/skills/graph-traversal/SKILL.md</file>
</skill>
<skill>
<name>ingest-pipeline</name>
<description>Supporting reference skill. REQUIRED when implementing or debugging ingest pipeline code in packages/cli/src/ingest/ or lint code in packages/cli/src/lint/. Triggers: dedup, source-store, RawSource, content_hash, computeTitleSimilarity, packages/cli/src/ingest/, packages/cli/src/lint/. Do not use for operational ikai workflows.</description>
<file>.github/skills/ingest-pipeline/SKILL.md</file>
</skill>
</skills>
