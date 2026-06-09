# StickForge Next Steps

## v0 status

This is a working browser prototype. It proves the basic pipeline, but the internal scene planner is intentionally crude.

## Best next move

Use one real essay and create a human/AI-crafted storyboard JSON. Then compare it against the built-in rule-based storyboard.

Recommended first essay candidates:

1. Civic Compute Compact
2. Dark Forest Theory
3. EPCOT / subscription city essay
4. AI likeness licensing essay

## Next build feature: JSON import

The most important missing feature is JSON import. That lets ChatGPT/Codex become the true director while the browser app remains the puppet theater.

## Better technical architecture later

### Browser-only version

Good for:

- prototyping
- script/storyboard editing
- quick WebM exports
- local/offline experimentation

Bad for:

- high-quality audio generation
- exact professional rendering
- MP4 export
- complex effects

### Remotion version

Good for:

- reproducible video rendering
- reusable animation components
- high-quality MP4 pipeline
- better automation

### Hybrid version

Best likely architecture:

1. Browser app for planning and editing
2. JSON project file as the source of truth
3. Remotion renderer for final export
4. External or provider-based TTS
5. FFmpeg final assembly

## Suggested generated-video modes

### Spark

Target: 3–5 minutes  
Scene count: 6–10  
Use case: one idea, one lesson, one visual metaphor

### Standard

Target: 7–9 minutes  
Scene count: 12–16  
Use case: main YouTube explainer

### Deep

Target: 12–18 minutes  
Scene count: 20–30  
Use case: pillar essay or complex theory

## Retention doctrine

- First 20 seconds must justify the video.
- Every scene teaches one idea.
- Every 8–15 seconds should have a visible change.
- Midpoint should escalate the argument.
- End with a memorable final line, not a begging CTA.
