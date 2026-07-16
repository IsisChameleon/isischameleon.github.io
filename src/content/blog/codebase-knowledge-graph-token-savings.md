---
title: Can a knowledge graph save your coding agent tokens?
date: 2026-07-16
description: "Three small experiments on a real repo, comparing grep-and-read exploration against graph queries with the codebase-memory MCP server. Spoiler: 10x to 36x fewer bytes into the context window."
tags: [mcp, llm-systems, dev-tools]
draft: false
---

<!-- Edit freely. The numbers below are real measurements from 2026-07-16, commands included so anyone can reproduce them. -->

Watch a coding agent explore an unfamiliar repo and you will see the same pattern every time: grep for a name, get a pile of matches, read three or four whole files to figure out which match matters. All of that lands in the context window. Tokens are money, but worse, they are attention: the more noise you stuff into the context, the more the model's focus degrades on the task you actually care about.

[codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) takes a different approach. It indexes your repository into a knowledge graph (functions, classes, routes as nodes; calls, imports, definitions as edges) and exposes it to the agent through MCP tools: `search_graph` to find symbols, `trace_path` to follow call chains, `get_code_snippet` to read exactly one symbol's source, and `query_graph` for raw Cypher when you want to get fancy.

The pitch is that a structural question should get a structural answer, not a pile of files. I wanted to know what that is worth in practice, so I measured it.

## The setup

The subject is [voicebox](https://github.com/IsisChameleon/voicebox), my voice-agent testing MCP server: a small Python repo that indexes to 368 nodes and 793 edges. For each question I measured the bytes that would enter the agent's context window on each path:

- **graph way**: the exact JSON returned by the MCP tool, saved to a file and counted with `wc -c`
- **grep way**: the grep output itself, plus the files the agent would then read (grep tells you *where* a name appears, not *what calls what*, so the reads are not optional)

I report bytes because that is what I can measure exactly. A rough conversion for English-plus-code is 4 bytes per token, and since it applies to both sides equally, the ratios hold either way.

## Experiment 1: who calls `compute_metrics`?

The classic impact-analysis question before touching a function.

**Graph way:**

```
trace_path(function_name="compute_metrics", direction="inbound", include_tests=true)
```

The answer came back as 1,753 bytes: ten callers with their qualified names and hop distance, tests flagged with `is_test: true`, production callers (`PipecatMCPAgent._dump_artifacts` at hop 1, `stop` at hop 2) immediately distinguishable from the eight test functions.

**Grep way:**

```
grep -rn "compute_metrics" .
```

The grep output is 2,363 bytes across 4 files. But a line number is not a caller: to know which hits are call sites and what calls *those*, you read the files. The four files total 60,369 bytes. I also tried the gentler variant where the agent reads a 100-line window around each hit instead of whole files: 70,447 bytes, *worse* than the full files, because `test_metrics.py` has so many hits that the windows overlap and repeat.

**Result: 1,753 vs 62,732 bytes. The graph answer is 36x smaller**, and it is also simply a better answer: callers with hop distance, not text matches.

## Experiment 2: show me one function

I asked for the source of `create_agent`, which lives at the very bottom of `agent.py`, a 716-line file.

**Graph way:**

```
get_code_snippet(qualified_name="...agent.create_agent")
```

2,979 bytes: the exact 28-line function, plus its file path, line range, signature, complexity metrics and caller/callee counts.

**Grep way:** the agent reads `agent.py`: 30,094 bytes, of which the function I wanted is about 4%. You can do better by reading a line window, but only if you already know the line number, which is itself a lookup.

**Result: 2,979 vs 30,094 bytes, 10x smaller.** The ratio here is simply the ratio of function size to file size, so it grows with your file sizes. On a 2,000-line service module it would be far larger.

## Experiment 3: the common-word trap

Now the fun one. What does `speak` touch? In a voice-agent repo, `speak` appears *everywhere*.

**Graph way:**

```
trace_path(function_name="speak", direction="both", depth=2)
```

2,927 bytes: 16 callees and 6 callers over two hops, qualified names included. You can see the whole blast radius (the playout tracker, the barge-in arming path, the event emitters) in one screen.

**Grep way:** `grep -rn "speak"` returns **184 hits**, and the grep output *alone* is 20,650 bytes, already 7x larger than the complete structured answer. The files containing hits total 219,470 bytes. Even a disciplined agent that only follows up on the three core modules (`agent.py`, `bot.py`, `server.py`) reads 47,823 bytes, for a total of 68,473.

**Result: 2,927 vs 68,473 bytes, 23x smaller** on the conservative count.

## The scorecard

| Question | Graph way | Grep way | Savings |
|---|---|---|---|
| Who calls `compute_metrics`? | 1,753 B | 62,732 B | 36x |
| Source of `create_agent` | 2,979 B | 30,094 B | 10x |
| What does `speak` touch? | 2,927 B | 68,473 B | 23x |

At roughly 4 bytes per token, the three questions cost about 1,900 tokens the graph way and about 40,000 tokens the grep way. On a small repo. Asked once. A real agent session asks dozens of these questions, and on repos ten times this size the grep-side numbers scale with file sizes while the graph-side numbers barely move.

## Honest caveats

- **Not every tool call is cheap.** `search_graph` returns rich node payloads (including internal fingerprint fields), so a broad search can cost a few thousand tokens. The discipline that works: search narrowly once to find the qualified name, then use `trace_path` and `get_code_snippet`, which are the genuinely compact calls.
- **Grep is still the right tool for strings.** Looking for an error message, a config key, a TODO? grep. The graph wins on *structural* questions: callers, callees, impact, definitions.
- **There is an upfront indexing cost**, though it runs outside the context window, so it costs seconds, not tokens, and the index persists between sessions.
- **Your numbers will differ.** The ratios depend on file sizes and how common your identifiers are. That is exactly why I included the commands: run them on your own repo.

The token savings are what you can put in a table, but the thing I notice day to day is the quality difference: the graph answer contains exactly the callers and nothing else, so the model reasons over signal instead of digging through noise. Less context rot, better answers, and my agent stops burning its budget on archaeology.
