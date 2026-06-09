# StickForge — GitHub + Public Sharing Guide

This repo is arranged so `index.html` sits at the repository root. That matters because GitHub Pages can publish this as a static browser app.

## Goal

Put StickForge online so anyone can try it from a normal link, without downloading a ZIP.

Expected public URL:

```text
https://stevo77530.github.io/Stickforge/
```

## Turn on GitHub Pages

1. Open the `Stickforge` repository.
2. Go to **Settings**.
3. Go to **Pages** in the left sidebar.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
5. Branch: `main`.
6. Folder: `/ (root)`.
7. Click **Save**.

GitHub may take a few minutes to publish.

## What to test after publishing

Open the Pages link and verify:

- The app loads.
- **Load Sample** works.
- **Generate Scene Plan** works.
- **Play** works.
- **Test Voice** works.
- **Record Tab + Voice** works if you select the app tab/window and enable tab audio.

## Social post option

I built a rough browser prototype called StickForge.

It turns essays or concepts into simple narrated stick-figure explainer animations. It is not polished. It is not trying to make Shorts. The goal is medium-length educational idea videos that teach clearly without feeding the dopamine sewer.

Try it here:

```text
https://stevo77530.github.io/Stickforge/
```

Paste an idea, pick a mode, generate a scene plan, and see what the goblin does.

## Public caveat

Do not paste private essays, personal notes, credentials, API keys, or anything sensitive into public demos. The current app runs in-browser, but public links still invite public behavior. Don't feed the goblin secrets.
