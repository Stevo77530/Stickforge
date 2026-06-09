# Codex Handoff Prompt — StickForge v0 Upgrade

You are upgrading a local prototype called StickForge.

## Mission

Turn the existing vanilla HTML/CSS/JS prototype into a more reliable video-generation pipeline for medium-length educational YouTube explainers.

Preserve the doctrine:

- No Shorts
- No dopamine-feed sludge
- Medium-length educational videos
- Clear teaching
- Strong retention rhythm
- Optional monetization is secondary

## Current prototype

Files:

- `index.html`
- `src/style.css`
- `src/app.js`
- `docs/scene_schema.json`

Current capabilities:

- Paste essay
- Choose mode: Spark, Standard, Deep
- Generate crude rule-based storyboard
- Preview stick-figure animation on canvas
- Export script and JSON
- Browser-native voice preview
- Tab recording path for voice capture
- Record WebM using MediaRecorder

## Upgrade priorities

### Phase 1 — Stabilize vanilla prototype

1. Add **Import JSON** so ChatGPT-generated storyboards can replace the crude rule-based planner.
2. Add scene editor cards:
   - edit narration
   - edit on-screen text
   - edit duration
   - edit visual type/action
3. Add local autosave using `localStorage`.
4. Add export project bundle as `.json`.
5. Add recording status and explicit stop controls.

### Phase 2 — Better renderer

1. Add reusable visual primitives:
   - map
   - factory
   - brain
   - courtroom
   - ship/tugboat
   - council table
   - skull/death marker
   - glowing AI oracle
2. Add more actions:
   - collapse
   - transform
   - trade
   - vote
   - build
   - flee
   - argue
   - discover
3. Add visual rhythm inside scenes:
   - visible change every 8–15 seconds
   - prop entrance/exit
   - camera push/pan/cut

### Phase 3 — Real pipeline

Recommended path:

- Keep browser app as planner/editor.
- Add a Node/Remotion renderer for higher-quality export.
- Use FFmpeg for final MP4 conversion.
- Use external TTS at first; later add provider adapters.

## Acceptance criteria

No bullshit acceptance checklist:

- A user can paste an essay and produce a playable animation without editing code.
- A user can import a better ChatGPT-generated JSON storyboard.
- A user can preview and revise scenes.
- A user can record/export at least WebM reliably.
- The system never defaults to Shorts.
- The generated structure respects mode runtime and retention logic.
