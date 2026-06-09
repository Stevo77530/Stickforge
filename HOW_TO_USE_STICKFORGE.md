# StickForge v0.1 — How to Use It

StickForge is a local/browser prototype for turning an essay into a crude-but-useful stick-figure explainer video.

It is not polished. It is not magic. It is the first working goblin.

## Recommended browser

Use **Chrome** or **Microsoft Edge** on desktop/laptop.

Firefox may preview parts of the app, but the tab-recording and audio-capture path is most reliable in Chrome/Edge.

## Basic startup

1. Open the public GitHub Pages link or open `index.html` locally.
2. Click **Load Sample** to test the included Civic Compute sample, or paste your own essay into the essay box.
3. Choose a mode:
   - **Spark** — 3–5 min
   - **Standard** — 7–9 min
   - **Deep** — 12–18 min
4. Choose a visual style and tone.
5. Click **Generate Scene Plan**.
6. Click **Play** to preview.

## Ugly voice path: browser voice preview

1. Make sure **Browser voice preview** is checked.
2. Choose a voice from **Narrator voice**.
3. Adjust voice rate and pitch.
4. Click **Test Voice**.
5. Click **Play**.

This uses the built-in voices installed on your computer/browser. Some sound like a haunted Microsoft receptionist. That is expected.

## Recording with voice baked in

Because browsers do not easily let normal canvas recording capture text-to-speech audio, use the tab recording workaround.

1. Generate your scene plan.
2. Keep **Browser voice preview** checked.
3. Click **Record Tab + Voice**.
4. Chrome/Edge will ask what you want to share.
5. Select the StickForge tab/window.
6. Enable tab audio/system audio if offered.
7. Click **Share**.
8. Let the whole video run.
9. StickForge downloads a `.webm` file.

## Normal recording without browser voice

Use **Record WebM** when you want to record the canvas directly.

This path may not capture browser text-to-speech. For cleaner production, create a voiceover externally, then use a separate editor or future renderer pipeline.

## Converting WebM to MP4

If you have FFmpeg installed:

```bash
ffmpeg -i stickforge_output.webm -c:v libx264 -c:a aac stickforge_output.mp4
```

## Suggested workflow for one essay

1. Paste essay.
2. Choose **Standard** mode.
3. Generate scene plan.
4. Read the narration tab.
5. Export script.
6. Generate better voice externally if desired.
7. Record video.
8. Convert to MP4 if needed.
9. Watch the full output and mark scenes that are boring, unclear, or visually repetitive.

## Known limitations

- The built-in scene planner is primitive and rule-based.
- The visual engine is intentionally simple.
- Browser TTS quality depends on your system voices.
- Normal canvas recording does not reliably capture browser text-to-speech.
- Tab recording is clunky, but it works.
- Export format is `.webm`, not `.mp4`.
- Timing may need manual adjustment for polished videos.

## The important idea

StickForge should not try to be Pixar.

It should be a controlled, repeatable argument-cartoon machine:

Essay in.  
Scene logic out.  
Stick figures explain the idea.  
Voice makes it watchable.  
No Shorts. No sludge. No bullshit.
