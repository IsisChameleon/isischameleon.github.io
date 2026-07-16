---
title: Testing voice agents with voicebox
date: 2026-07-16
description: "How I gave my coding agent a voice and ears so it could test my voice app for me: the story of voicebox, an MCP server that grew out of Daily's pipecat-mcp-server."
tags: [voice-ai, evals, mcp]
draft: false
---

<!-- Feel free to edit: every section stands on its own, so you can cut, reorder or rewrite any of them independently. Places where a personal touch would land well are marked with comments like this one. -->

If you are building a browser voice agent, you already know the loop. You tweak a prompt, then you open the tab, join the call, talk to the bot, listen, try to interrupt it, try to break it. By hand. Every single time.

I hit this wall building readme, a voice app where an AI companion reads books with children. Claude Code was writing most of the pipeline changes, but it had no way to check its own work: it could not hear whether the app still greeted you properly, whether barge-in still worked, whether latency had regressed. I was the only tester, and I was slow.

So I built [voicebox](https://github.com/IsisChameleon/voicebox), an open source MCP server that gives a coding agent a voice and ears. Claude drives a real Chromium, speaks into the page's microphone through local Kokoro TTS, and hears the agent's replies back through local Whisper. You hand it a task in plain language, something like *"start the story, interrupt halfway, then ask something off-topic"*, and it holds the conversation against your app and reports what happened.

## Where it comes from

Credit where it is due: voicebox started life as a fork of [pipecat-mcp-server](https://github.com/pipecat-ai/pipecat-mcp-server) by the [Pipecat](https://github.com/pipecat-ai/pipecat) team at Daily. Their server does something delightful: it gives your AI agent a voice, so you can *talk to your coding agent* while it works, using a Pipecat pipeline with Kokoro TTS and Whisper STT running locally.

At some point I realised the interesting move was to flip it around. I did not need to talk to my agent. I needed my agent to talk to my app. The same pipeline that lets an LLM converse with a human can impersonate a human toward another voice agent. The pieces were all there: Pipecat for the audio pipeline, local models so there are no API keys to manage, MCP so any coding agent can drive it.

The fork kept the engine and replaced the transport. Instead of joining a Daily room or the Pipecat playground, voicebox drives a real browser and pretends to be a person sitting in front of it. The license is BSD-2-Clause, inherited from upstream, and the project would not exist without their work.

## The trick: hijack the microphone

The core problem is getting audio in and out of a web app that expects a human with a microphone. voicebox solves it with a small JavaScript shim injected into a Playwright-controlled Chromium before any page code runs:

- it overrides `navigator.mediaDevices.getUserMedia`, so when the app asks for a microphone it gets a synthetic stream backed by `MediaStreamTrackGenerator`, fed by Kokoro TTS from the server
- it wraps `RTCPeerConnection` and tees every inbound audio track back to the server through Web Audio, where Whisper transcribes it

The app is none the wiser. From its point of view a normal caller joined with a normal microphone. This works against anything that uses `getUserMedia` plus WebRTC: Daily, LiveKit, a plain `RTCPeerConnection`, whatever your stack is.

## How the pieces fit

<img src="/images/voicebox-architecture.png" alt="voicebox system diagram: Claude drives voicebox over MCP and Chromium over CDP; a Pipecat child process exchanges raw PCM audio with the injected shim over a WebSocket, while the page talks WebRTC to the app backend under test" width="1288" height="1000" loading="lazy" />

<!-- The live animated version of this diagram is at /diagrams/voicebox-architecture.html if you want to link it. -->

Three processes, and one rule that keeps the design honest: **audio never crosses the MCP boundary**. MCP carries text and control only. The actual audio flows out-of-band, as raw 16-bit PCM over a WebSocket between the shim inside the page and a Pipecat child process. The parent process hosts the MCP endpoint and no audio code at all, so a busy pipeline can never block a tool call.

The MCP surface is deliberately tiny:

| Tool | What it does |
|---|---|
| `start_browser_session(url, ...)` | Launch Chromium with the shim injected, navigate to your app, expose CDP |
| `speak(text)` | Kokoro synthesizes the text into the page's synthetic mic |
| `listen(timeout)` | Block until the bot finishes an utterance, return the Whisper transcript |
| `stop()` | Tear everything down |

Notice what is missing: no click, no navigate. voicebox owns the browser but hands the CDP endpoint back to Claude, which attaches its usual Playwright client (`npx @playwright/mcp@latest --cdp-endpoint=http://localhost:9222`) to do the logging in and button clicking. Each tool does one job.

## Things that bit me along the way

This is the part I wish someone had written down before I started.

**The recording that played back too fast.** My first audio tap used WebCodecs (`MediaStreamTrackProcessor`). It worked, except the recorded WAV of the bot played back several times faster than real time, like a chipmunk. The reason: on a remote WebRTC track, WebCodecs only emits chunks during active speech. Silence is simply dropped, so the byte stream is sparse and everything downstream compresses in time. The fix was to tap through Web Audio instead (`MediaStreamAudioSourceNode` into an `AudioWorkletNode`), which is pulled by the audio clock at a fixed rate, so silence becomes literal zero samples and real-time pacing survives.

**Whisper-MLX hard-assumes 16 kHz.** `mlx_whisper.transcribe()` has no sample rate parameter at all. Rather than resample in Python, the shim's outbound `AudioContext` simply runs at 16 kHz and lets the browser do the 48 to 16 resample natively. Kokoro stays at 48 kHz on the way in, so the synthetic mic the app hears is full quality. The sample rates are asymmetric on the wire and that is fine.

**Pipecat's defaults are tuned for a different job.** Its default VAD `stop_secs` of 0.2 s expects clean TTS input and chopped my remote speech mid-sentence (1.0 s works). And its default interruption behaviour meant that the moment the bot started talking, our own in-flight speech got cancelled. Reasonable for an assistant, fatal for a tester whose whole job is sometimes to talk over the bot.

## From remote-controlled mouth to test harness

The first version was really just a mouth and ears on a stick: Claude called `speak`, then `listen`, one blocking call at a time. Useful, but not yet a testing tool.

Before going further I looked at how the commercial voice-agent testing platforms are engineered: Cekura, [Coval](https://docs.coval.ai/concepts/metrics/overview), [Hamming](https://hamming.ai/resources/voice-agent-testing-guide), ServiceNow's [EVA](https://github.com/ServiceNow/eva), and the open source [fixa](https://github.com/fixadev/fixa). Two lessons stood out.

First, nobody polls. Every serious tool makes the synthetic caller a full voice pipeline of its own, with its own VAD deciding when to talk, not an outer LLM loop. Second, nobody does reactive LLM-driven interruption, because an LLM round trip is far too slow to barge in on cue. Interruption is a persona parameter executed by the audio pipeline: the scenario says "this caller interrupts", the pipeline picks the moment, and the metric that matters is how fast the agent under test shuts up (the industry budget is about 60 ms).

That research turned into a staged rebuild:

- **Full-duplex IPC.** Every command carries a correlation id, so `speak` can fire while a `listen` is pending. Talk-over became physically possible.
- **An event stream instead of a transcript string.** `listen` now returns timestamped events (`bot_speech_started`, `transcript`, `tts_interrupted`, ...) with a cursor, so Claude never misses or re-reads anything.
- **Declarative barge-in.** `speak(text, when="app_bot_speech_started", timer_secs=1.5)` arms a one-shot trigger in the audio child: next time the bot starts talking, wait 1.5 s, then speak. Reproducible interruptions, scheduled at audio rate, no LLM in the hot path.
- **Artifacts.** Every session writes a stereo WAV (tester on one channel, bot on the other, a convention borrowed from EVA), plus `events.json` and `metrics.json` with per-turn response latency, dead-air gaps and talk-over windows. A test that does not leave evidence behind is just a demo.

The one place voicebox genuinely differs from all of those tools: they join calls through APIs (phone numbers, LiveKit rooms), which requires the platform's cooperation. The browser shim reaches apps whose WebRTC internals you cannot join at all, anything that only exists as a webpage. That gap is the niche.

## Try it

```bash
git clone https://github.com/IsisChameleon/voicebox.git
uv tool install -e ./voicebox
voicebox   # MCP server on http://localhost:9090/mcp

claude mcp add voicebox --transport http http://localhost:9090/mcp --scope user
```

Local models by default, so no API keys to run it. Point it at any browser voice app and ask your coding agent to have a chat with it.

What is next: a scenario layer (persona, goal, success criteria, run it N times, judge the transcript and metrics afterwards), and maybe session replay, where a recorded failing call becomes a regression test.

<!-- Personal closing line? e.g. what it felt like the first time Claude interrupted the bot on its own. -->

## Credits

voicebox stands on [pipecat-mcp-server](https://github.com/pipecat-ai/pipecat-mcp-server) and [Pipecat](https://github.com/pipecat-ai/pipecat) by Daily, [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) for TTS, and [Whisper](https://github.com/ml-explore/mlx-examples) (MLX) for STT. BSD-2-Clause, inherited from upstream.
