---
name: write-blog
description: Use when writing, drafting, or substantially editing a blog post, write-up, or article for Isabelle (site posts in src/content/blog/, Hashnode posts, dev.to, LinkedIn articles). Also use when asked to "write it in my voice" or when a draft reads too polished/generic.
---

# Writing blog posts in Isabelle's voice

## Overview

Isabelle's posts are **learning-in-public walkthroughs**, not essays. She shares what she tried, what worked, what annoyed her, and hands the reader the code to try it themselves. A draft that reads like a keynote or a whitepaper is wrong, no matter how good the content is.

## Before drafting (required)

Read 1–2 sample posts from `references/` in this skill's directory — pick the ones closest in genre to the post you're writing. Do NOT skip this because you "know the style" from this file; the samples carry the rhythm this summary can't.

## Voice rules

1. **First-person journey, real chronology.** "I joined a hackathon…", "So I decided to go ahead", "I was mildly annoyed by the fact that…". Reactions and detours stay in the text — they ARE the content.
2. **Anchor to a runnable artifact early.** Link the notebook/gist/repo near the top ("The code is available here"). Every claim should be reproducible by the reader.
3. **Talk TO the reader.** "Go ahead and run section 1 and 2", "play around with the prompt and see what you get", "check my previous blog on the topic".
4. **Explain concepts in plain language, inline, with links out.** A short intuitive explanation (analogy welcome: "Semantic search to the rescue"), then link to deeper resources (docs, HuggingFace/Pinecone-style explainers, Wikipedia quotes are fine). Number citations [1] when quoting.
5. **Report failures and rough edges honestly.** Hallucinations, missing library features ("does not (yet?) support…"), dead ends. Never sand off the disappointing result.
6. **Practical asides.** Costs, API-key security, budget limits, response-time trade-offs — the things a practitioner actually hits.
7. **Rhetorical questions as hooks.** "So, Gemini, where's Wally?", "How do we stuff all of our private data in that tiny context?"
8. **Warm, lightly playful closing that invites the reader in.** Questions, comments, "let me know what topic you'd like next". An emoji or two across the whole post is in-voice; more is not.
9. **Grounded examples.** Real datasets/problems from her world (Australia, NDIS, kids' reading app, voice agents) over toy foo/bar examples.

## What is NOT her voice (common failure)

- Grand thesis openers ("In the rapidly evolving landscape of…") — she opens with a date, an event, or a concrete problem.
- Perfectly parallel headline-case section titles; hers are plain and specific.
- "We" as author-voice throughout — she uses "I" for herself, "we/you" when walking the reader through steps.
- Punchy one-liner paragraphs for drama. Her paragraphs are relaxed and chatty, sometimes long.
- Marketing superlatives about her own results. Numbers + "pretty decent answer" is the register.
- Do not imitate typos or grammar slips from the samples; write clean but unfussy English.

## Checklist before delivering a draft

- [ ] Read at least one reference sample this session
- [ ] Code/artifact linked near the top
- [ ] At least one honest limitation or failed attempt included
- [ ] Reader addressed directly somewhere ("you can…", "try…")
- [ ] Closing invites comments/questions
- [ ] No thesis-statement opener, no marketing tone
