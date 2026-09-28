# StickForge v0.3

StickForge is a browser-based prototype for turning essays or concepts into crude stick-figure explainer animations.

It is intentionally simple: paste an essay, choose a mode, generate a scene plan, preview the animation, test browser voice, and record/export a rough video.

## Try it locally

Open:

```text
index.html
```

Recommended browser: Chrome or Edge.

## Main features

- Paste essay or load sample
- Generate crude scene plan
- **Import JSON storyboards** written by ChatGPT/Claude (paste or file)
- **Scene editor**: edit narration, on-screen text, duration, visual, action, camera; reorder, duplicate, delete, add
- **Autosave** to browser localStorage, plus **New Project** to clear
- **Export Project** bundle (essay + settings + storyboard), re-importable
- Preview stick-figure animation
- Browser-native voice preview
- Voice selection, rate, and pitch controls
- Tab recording path for voice capture
- Export narration script
- Export storyboard JSON
- Record WebM video with live status and a **Stop Recording** button
- Optional narration audio file: plays in sync and is baked into Record WebM

## Modes

- **Spark** — short concept test
- **Standard** — default educational explainer mode
- **Deep** — longer essay adaptation mode

No Shorts mode. This tool is designed for medium-length educational content, not dopamine-feed trash confetti.

## Important docs

- `HOW_TO_USE_STICKFORGE.md` — operating instructions
- `DEPLOY_AND_SHARE.md` — GitHub Pages and social launch guide
- `docs/scene_schema.json` — scene plan format
- `docs/codex_handoff_prompt.md` — Codex handoff prompt
- `docs/next_steps.md` — roadmap

## Public deployment

This package is GitHub Pages ready because `index.html` is at the repository root and `.nojekyll` is included.

Expected GitHub Pages URL:

```text
https://stevo77530.github.io/Stickforge/
```

## Known v0.3 limits

- Browser voice does not behave consistently across every device/browser.
- Voice recording relies on browser tab capture.
- Export is WebM, not MP4.
- The built-in scene planner is rule-based and primitive. Import a JSON storyboard for real direction.
- Autosave lives in one browser. Use Export Project to move work between machines.
- The animation system is intentionally crude.

This is a working goblin, not a finished cathedral.
