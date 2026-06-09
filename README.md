# StickForge v0.1

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
- Preview stick-figure animation
- Browser-native voice preview
- Voice selection, rate, and pitch controls
- Tab recording path for voice capture
- Export narration script
- Export storyboard JSON
- Record WebM video

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

## Known v0.1 limits

- Browser voice does not behave consistently across every device/browser.
- Voice recording relies on browser tab capture.
- Export is WebM, not MP4.
- The scene planner is rule-based and primitive.
- The animation system is intentionally crude.

This is a working goblin, not a finished cathedral.
