---
title: Can a knowledge graph save your coding agent tokens?
date: 2026-07-03
description: "Three questions measured on two real repos, comparing grep-and-read exploration against graph queries with the codebase-memory MCP server. Plus how the index stays fresh while you code, what the edge types actually mean, and three queries worth stealing."
tags: [mcp, llm-systems, dev-tools]
draft: false
cover: /images/blog/codebase-graph-cover.webp
---

<!-- Numbers are real measurements. Byte counts: July 2026 on v0.7.x. Freshness, edge types, queries and "beyond tokens" sections: re-verified 5 August 2026 on v0.9.0. Commands included so anyone can reproduce them. -->

I was watching Claude Code poke around [voicebox](https://github.com/IsisChameleon/voicebox) one evening, and it did the thing it always does in a repo it doesn't know yet: grep for a name, get a pile of matches back, then open three or four whole files to work out which of those matches actually mattered. All of it lands in the context window. Tokens are money, sure, but the thing that bothers me more is attention: the more noise you stuff into the context, the worse the model gets at the thing you actually asked for.

[codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) takes a different route. It indexes your repository into a knowledge graph (functions, classes and routes as nodes; calls, imports and definitions as edges) and hands it to the agent through MCP tools: `search_graph` to find symbols, `trace_path` to follow call chains, `get_code_snippet` to read exactly one symbol's source, and `query_graph` for raw Cypher when you want to get fancy.

[![codebase-memory-mcp on GitHub](/images/blog/codebase-memory-mcp-og.webp)](https://github.com/DeusData/codebase-memory-mcp)

Credit where it is due before we go any further. codebase-memory-mcp is open source and built by the [DeusData](https://github.com/DeusData) team. Everything measured in this post is their work, I just put numbers on it. If what follows convinces you, go give [the repo](https://github.com/DeusData/codebase-memory-mcp) a star.

The pitch is that a structural question should get a structural answer instead of a pile of files. I wanted to know what that is worth in practice, so I measured it. Then, because a few people asked me the obvious follow-up questions (does the index go stale while I code? what else is in there?), I went back and measured those too.

## The setup

I ran the same three questions on two repos, so the ratios are not one lucky codebase:

- **voicebox**, my voice-agent testing MCP server. Small Python repo, 368 nodes and 793 edges.
- **readme**, the codebase behind [EmberTales](https://app.embertales.ai), my AI reading companion for children. A full-stack app, FastAPI + Pipecat voice-bot server in Python (about 24,000 lines across 160 files) plus a Next.js client, indexing to 5,190 nodes and 15,794 edges. Fourteen times the voicebox graph.

For each question I measured the bytes that would enter the agent's context window on each path:

- **graph way**: the exact JSON returned by the MCP tool, saved to a file and counted with `wc -c`
- **grep way**: the grep output itself, plus the files the agent would then read (grep tells you *where* a name appears, not *what calls what*, so the reads are not optional)

I report bytes because that is what I can measure exactly. A rough conversion for English-plus-code is 4 bytes per token, and since it applies to both sides equally, the ratios hold either way.

![The Codebase Memory projects dashboard: six indexed repos, including voicebox (368 nodes / 793 edges) and readme (5,190 nodes / 15,794 edges)](/images/blog/codebase-memory-projects.webp)

![The readme repo as codebase-memory sees it: 5,190 nodes and 15,794 edges](/images/blog/readme-graph.webp)

## Question 1: who calls this function?

The classic impact-analysis question before you touch anything.

```
trace_path(function_name="compute_metrics", direction="inbound", include_tests=true)
```

On voicebox that is **1,753 bytes**: ten callers with qualified names and hop distance, tests flagged with `is_test: true`, production callers immediately distinguishable from the eight test functions. Grep gives you 2,363 bytes across 4 files, but a line number is not a caller, so to know which hits are call sites you read the files: 60,369 bytes. (I tried the gentler variant where the agent reads a 100-line window around each hit instead of whole files. It came to 70,447 bytes, *worse* than the full files, because `test_metrics.py` has so many hits that the windows overlap and repeat.) **1,753 vs 62,732 bytes, 36x.**

On readme the same question is `Library.initialize_book`, the book-loading seam of the whole app. Grep returns **61 hits**; excluding tests still leaves 11 hits across 4 files totaling 51,292 bytes, and almost all of them turn out to be prose, comments like *"progress to the store on initialize_book"*, not code. The graph answer is **186 bytes**: one production caller, `ReadingTools.select_book`. That is **281x**.

The gap between 36x and 281x is the most interesting number in this post, and I had not anticipated it. On a mature codebase a function's name accumulates *mentions* far faster than it accumulates *callers*. Grep scales with mentions. The graph scales with callers. Those two diverge as a codebase ages.

Score one for grep, though: it also caught a call in `scripts/trace_reading_session.py`, a dev harness, which the graph missed because the call goes through a locally constructed instance the indexer did not resolve. Hold that thought.

## Question 2: show me one function

`create_agent` sits at the very bottom of `agent.py`, a 716-line file.

```
get_code_snippet(qualified_name="...agent.create_agent")
```

**2,979 bytes**: the exact 28-line function, plus file path, line range, signature, complexity metrics and caller/callee counts. Reading `agent.py` instead costs 30,094 bytes, of which the function I wanted is about 4%. **10x.** On readme, `_build_qa_settings` out of a 698-line processor came to 4,026 vs 30,884 bytes, **7.7x**.

This is the one ratio that does not move between repos, because it is just function size over file size. It grows with your file sizes, not your repo size.

## Question 3: the common-word trap

What does `speak` touch? In a voice-agent repo, `speak` appears *everywhere*.

```
trace_path(function_name="speak", direction="both", depth=2)
```

**2,927 bytes**: 16 callees and 6 callers over two hops. `grep -rn "speak"` returns **184 hits** and the grep output *alone* is 20,650 bytes, already 7x larger than the complete structured answer. Files containing hits total 219,470 bytes; even a disciplined agent that only follows up on the three core modules reads 47,823, for 68,473 total. **23x.**

On readme this stopped being about volume and became about *correctness*. The repo has a function called `get_client`, grep finds **205 hits**, and here is what grep cannot tell you at all: there are **two different functions with that name**, one returning the Supabase client and one returning the Gemini client. Every one of those 205 hits looks identical in grep output. So which client is this file talking to? `search_graph` plus `trace_path` costs **3,162 bytes** and answers with qualified names. A disciplined grep agent reading only the 16 non-test files ingests 79,806. **25x**, and more importantly an answer grep cannot give you at any price.

## The scorecard

| Question | Repo | Graph way | Grep way | Savings |
|---|---|---|---|---|
| Who calls `compute_metrics`? | voicebox | 1,753 B | 62,732 B | 36x |
| Who calls `initialize_book`? | readme | 186 B | 52,310 B | 281x |
| Source of `create_agent` | voicebox | 2,979 B | 30,094 B | 10x |
| Source of `_build_qa_settings` | readme | 4,026 B | 30,884 B | 7.7x |
| What does `speak` touch? | voicebox | 2,927 B | 68,473 B | 23x |
| What depends on `get_client`? | readme | 3,162 B | 79,806 B | 25x |

At roughly 4 bytes per token, the three voicebox questions cost about 1,900 tokens the graph way and about 40,000 the grep way. On a small repo. Asked once. A real agent session asks dozens of these.

## So the index is built. Does it go stale while I keep coding?

This was the first question everyone asked me, and it is the right one. A graph that reflects last Tuesday's code is worse than no graph, because you will trust it.

There is a background watcher, and it is worth knowing how it works before you rely on it, so I read it ([`src/watcher/watcher.c`](https://github.com/DeusData/codebase-memory-mcp/blob/main/src/watcher/watcher.c)). It polls git rather than watching the filesystem: it keeps the last `git rev-parse HEAD` per project, which catches commits, checkouts and pulls, and runs `git status --porcelain` for uncommitted edits, with a `git submodule foreach` pass so submodule changes are not missed. The poll interval adapts to repo size, starting at 5 seconds and adding a second per 500 tracked files, capped at 60.

Two consequences that matter daily, and neither is in the marketing copy. **Non-git projects are not watched at all**, because there is no fsnotify fallback yet, so a scratch directory outside git needs re-indexing by hand. And **change detection is git-shaped**: gitignored files do not move `git status`, so they never trigger a re-index.

You turn it on with one line:

```bash
codebase-memory-mcp config set auto_index true
```

New projects then get indexed the first time your agent connects, with a file ceiling (`auto_index_limit`, 50,000) so a monster repo does not index itself behind your back.

Does it keep up? voicebox was 368 nodes and 793 edges in July. I have merged a fair bit since, and without me ever asking for a re-index, `list_projects` now reports 937 nodes and 1,934 edges. So yes, it followed along.

## Keeping the tool itself up to date

This changed under me between 0.8.1 and 0.9.0, so be precise about which version you are on:

```bash
codebase-memory-mcp --version
codebase-memory-mcp update
```

On 0.8.1 `update` did the work itself and warned it would drop every index on the way through. On 0.9.0 it does not: it checks your flags and prints the command to run, which is the install script sitting next to the binary (`bash "<install-dir>/install.sh"`). The script is idempotent, so re-running it *is* the update. On Windows a running executable cannot overwrite its own image, so rather than ship two update mechanisms they made every platform work the same way.

The half that caught me out: **0.9.0 does not tell you when a new version exists.** On 0.8.1 the server checked for a release and surfaced a notice on your first tool call, which is how I noticed I was behind. That check is deliberately gone, and the source says why, in a comment sitting where the provider used to be ([`src/daemon/application.c`](https://github.com/DeusData/codebase-memory-mcp/blob/main/src/daemon/application.c)):

> There is deliberately NO production update-check provider. The daemon used to spawn `curl` against the GitHub releases API on the first eligible session of every run, purely to print "a newer version exists". That put a release URL and an outbound request into every shipped binary, and made a developer tool phone home from every agent session.

I would rather my dev tools did not phone home, so I think that is the right call. But nothing will nudge you any more, so check your version before you go filing a bug. I wasted a good evening on exactly that mistake.

## What else it does once the graph exists

Token savings are what you can put in a table, so that is what gets written about. But once the graph is sitting there, most of what I use it for has nothing to do with saving tokens.

**An architecture read on a repo you have never seen.** `get_architecture` returns languages, packages, routes, hotspots, layers and clusters in one call. The clusters come from community detection over the call graph, so they surface the de-facto modules rather than your folder names. On voicebox it correctly picks `speak` as the top hotspot by fan-in. Try it on a repo you just joined, before you start reading files.

**Complexity and hot paths, as a query.** Every function node carries `cyclomatic`, `cognitive`, `loop_depth`, and the one I actually use, `transitive_loop_depth`, which propagates worst-case nested-loop degree along `CALLS` edges. There is also `linear_scan_in_loop`, counting `find`/`contains`-style scans inside a loop, the hidden O(n²) that plain loop nesting misses:

```
MATCH (f:Function)
WHERE f.transitive_loop_depth >= 3 OR f.linear_scan_in_loop >= 1
RETURN f.name, f.transitive_loop_depth, f.complexity
ORDER BY f.transitive_loop_depth DESC
```

On readme that handed me `assemble_branching_chunks` at a transitive loop depth of 5, plus `_build_chapters` and `extract_manuscript` at 4. A performance to-do list I did not have to go looking for.

**Searching by meaning, not spelling.** `search_graph` combines BM25 full-text with camelCase splitting, regex `name_pattern`, and `semantic_query`, a vector search that bridges vocabulary, so searching "send" finds something named "publish". The embeddings are compiled into the binary: no API key, no Ollama container to babysit.

**Decisions that outlive the session.** `manage_adr` stores Architecture Decision Records in the graph. Given that my agent forgets everything between sessions, parking the "why" next to the "what" is the feature I underrated most.

**Two more worth knowing.** `detect_changes(project=..., since="HEAD~5")` maps a git diff to the symbols it touches and classifies the risk, which is a better pre-commit question than "what did I change". And `index_repository(mode="cross-repo-intelligence")` matches routes between separately indexed projects, which is how you trace a call from a Next.js client into the FastAPI handler serving it.

## What the edges actually mean

Before the queries, the bit I wish I had read first. I had been thinking of this as "the call graph", which undersells it and also made me write some wrong queries. There are around twenty edge types, and knowing which one carries your question is most of the skill. The ones worth knowing ([README](https://github.com/DeusData/codebase-memory-mcp#edge-types-selected)):

| Edge | What it means |
|---|---|
| `CALLS` | a callable is invoked at the source site |
| `CALL_REFERENCE` | a callable is passed as a value (a callback, say) and resolves to one exact target |
| `USAGE` | an identifier is used, but a unique callable target is not proven |
| `DEFINES`, `IMPORTS`, `INHERITS`, `IMPLEMENTS` | the structural skeleton |
| `DATA_FLOWS` | value propagation, with argument-to-parameter mapping and field access chains |
| `TESTS` | links a test to what it exercises |
| `FILE_CHANGES_WITH` | mined from git history, not from the code, with a coupling score |
| `SIMILAR_TO` | near-clone detection (MinHash + LSH, Jaccard scored) |
| `SEMANTICALLY_RELATED` | same language, vocabulary mismatch, score 0.80 or better |
| `HTTP_CALLS`, `ASYNC_CALLS`, `EMITS`, `LISTENS_ON` | cross-service and pub/sub links |

Two of those changed how I use the thing. `FILE_CHANGES_WITH` is not static analysis at all, it is your git history as graph edges. And `SIMILAR_TO` plus `SEMANTICALLY_RELATED` mean you can ask "what looks like this" rather than "what calls this".

Run `get_graph_schema(project=...)` to see which types your repo actually produced and how many of each, because it varies a lot by language and by how much history you have. voicebox gives me 425 `CALLS`, 344 `USAGE`, 84 `TESTS` and 27 `FILE_CHANGES_WITH`.

## Three queries that earn their keep

The Cypher endpoint is the part I underused for months, because "you can write queries" is not a feature until someone shows you a query worth writing. Here are three I keep coming back to, run against voicebox on 0.9.0, with the output I actually got back.

**1. What am I most likely to break?** Before touching anything in a repo I do not know well, I want the fan-in ranking: which functions does everything else lean on. Note the `STARTS WITH 'src/'` filter, which keeps Python builtins and the test tree out of the answer. Without it the top of the list is `len`, `append` and `print`, which is true and useless.

```
MATCH (a)-[:CALLS]->(b)
WHERE b.file_path STARTS WITH 'src/'
RETURN b.name, b.file_path, count(a) AS fan_in
ORDER BY fan_in DESC
```

On voicebox that puts `speak` on top with a fan-in of 12, then `_emit` at 8 and `_emit_app_bot_transcript` at 7. Which is the correct answer for a voice-agent repo, and it took one call instead of an afternoon.

**2. Which files always change together?** This is my favourite, because it is not a static-analysis question at all. The indexer mines your git history and creates `FILE_CHANGES_WITH` edges with a coupling score, so you can ask which files are *empirically* coupled regardless of whether there is a call edge between them:

```
MATCH (a)-[r:FILE_CHANGES_WITH]->(b)
RETURN a.name, b.name, r.co_changes, r.coupling_score
ORDER BY r.coupling_score DESC
```

voicebox gave me `agent.py` and `events.py` at 6 co-changes and a coupling score of 1.00, and `bot.py` with `server.py` at 7 co-changes and 0.88. A perfect score means every single time I touched one, I touched the other. That is the signature of a leaky seam, and it is invisible to every other tool in this post. Do read the pairs with judgement though, because a source file and its own test file co-change for entirely healthy reasons, and several of my top hits are exactly that.

**3. Dead code, with a large asterisk.** Every node carries an `in_degree` property specifically so you can ask this:

```
MATCH (f:Function)
WHERE f.in_degree = '0' AND f.is_entry_point = false
  AND NOT f.file_path STARTS WITH 'tests/'
RETURN f.name, f.file_path, f.lines
ORDER BY f.lines DESC
```

One syntax note: `in_degree` is compared as a string, so it is `= '0'` and not `= 0`.

The asterisk is that on voicebox this returned ten candidates and I would not delete a single one without looking first. `listen`, `speak` and `start_browser_session` in `server.py` are MCP tool handlers registered by decorator, so nothing in the repo calls them by name and they are about as far from dead as code gets. And `compute_metrics` is in the list at 62 lines, which is the exact function that eighteen real call sites point at. Treat this query as a list of things to go and look at, never as a list of things to delete.

## Where it falls down

- **Not every tool call is cheap.** `search_graph` returns rich node payloads, so a broad search can cost a few thousand tokens. The discipline that works for me: search narrowly once to get the qualified name, then use `trace_path` and `get_code_snippet`, which are the compact calls.
- **Grep is still the right tool for strings.** Looking for an error message, a config key, a TODO? grep. The graph wins on *structural* questions: callers, callees, impact, definitions.
- **The graph can miss edges, and this one bit me properly.** It missed that dev-script call site on readme, and worse, my headline measurement stopped reproducing entirely. That one gets its own section, next.
- **There is an upfront indexing cost**, though it runs outside the context window, so it costs seconds rather than tokens, and the index persists between sessions.
- **Your numbers will differ.** The ratios depend on file sizes and how common your identifiers are. That is exactly why I included the commands: run them on your own repo.

## What happened to question 1

The headline experiment of this post, the 36x one, does not reproduce for me today. Asking who calls `compute_metrics` now returns nothing:

```
trace_path(function_name="compute_metrics", direction="inbound", include_tests=true)
  -->  {"callers":[]}
```

I assumed I was on an old build, so I updated from 0.8.1 to 0.9.0, re-indexed voicebox from scratch with an explicit `mode="full"`, and ran it again. Identical. Zero callers, against eighteen real call sites: one in `agent.py:653` and seventeen in `tests/test_metrics.py`.

It is not the whole graph falling over. The node exists at the right file and line, it has nine *outbound* edges, and the `speak` trace from question 3 still works perfectly on the same index. The gap is startlingly narrow: exactly one hop in one chain. I built a minimal repo with six variants of the shape (function-local imports, nested `def`s, the call buried as an argument, `async`) to try to reproduce it, and all six resolved correctly, so none of my structural theories survived contact.

I would have happily published any one of those theories as the explanation if I had not checked, which is the actual lesson. It is also a limitation the authors clearly know about, because the tool ships instructions telling your agent that "findings are provisional: do not make absence, exhaustive-impact, or dead-code claims" ([`src/mcp/mcp.c`](https://github.com/DeusData/codebase-memory-mcp/blob/main/src/mcp/mcp.c)). I wish more tools shipped that.

So: the graph is excellent at telling you what *is* there, and that is where the 36x lives. It is not trustworthy for telling you what is *not* there. Presence, trust it. Absence, verify it. If a `trace_path` comes back empty and your gut says the function is used, spend one grep before you believe it. You still skip reading the files, so you keep almost all of the saving. And treat my 36x as a July measurement rather than a promise for today.

The savings are what you can put in a table, but the thing I notice day to day is the quality difference. The graph answer contains the callers and nothing else, so the model reasons over signal instead of digging through noise. Less context rot, better answers, and my agent stops burning its budget on archaeology. 🙂

Have you tried it on a repo much larger than mine, or in a language other than Python and TypeScript? I would love to know whether the impact-analysis ratio keeps climbing, and whether anyone can reproduce the missing `compute_metrics` callers. If you go looking with the queries above, tell me what your own repo's co-change pairs look like. Drop me a note, and tell me what you would like me to measure next.
