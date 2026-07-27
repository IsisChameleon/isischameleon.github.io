---
title: "voicebox: synthetic voice user for testing voice agents"
summary: Open-source MCP server that gives a coding agent voice and ears. It drives a real Chromium, speaks into the page's mic via local TTS, and hears the agent's replies via local STT, so it can test any browser-based voice app end to end.
tags:
  - Voice AI
  - Open source
  - MCP
featured: true
status: Open source
blog: testing-voice-agents-with-voicebox
links:
  github: https://github.com/IsisChameleon/voicebox
---

Testing a browser voice app means being the user: join the call, talk, listen, try to break it, by hand, every time you touch a prompt. voicebox automates that loop. It injects an audio shim into a Playwright-driven Chromium that hijacks `getUserMedia` and tees the app's WebRTC audio back to Whisper, while Kokoro TTS feeds the synthetic microphone. Works against anything using getUserMedia + WebRTC (Daily, LiveKit, plain RTCPeerConnection), with the app none the wiser and no API keys required.
