# Macro Tracker — Claude Code Setup Guide

A personal macro tracking PWA. Install to your iPhone home screen and use it like a native app.

## What's in this repo

- `index.html` — the entire app, single self-contained file
- `manifest.json` — makes it installable as a PWA
- `icon-180.png`, `icon-512.png` — app icons (you'll generate these — see below)

## Walkthrough with Claude Code

### Step 1: Get the files onto your machine

Open a terminal in a folder where you keep projects (e.g. `~/projects/`) and run:

```bash
mkdir macro-tracker
cd macro-tracker
```

Drop `index.html` and `manifest.json` from this conversation into that folder. Then start Claude Code:

```bash
claude
```

### Step 2: Generate the app icons

You need two PNG icons for the app to install properly. Ask Claude Code:

> Generate a simple flat icon for a macro tracker app — a flame emoji on a cream background (#FAFAF7), centered, no text. Make two sizes: 180×180 and 512×512, saved as icon-180.png and icon-512.png.

If Claude Code doesn't have an image generation tool available, alternatives:

- Use any flame emoji screenshot, resize in Preview (Mac) or any image editor to 180×180 and 512×512
- Use [favicon.io/emoji-favicons](https://favicon.io/emoji-favicons/) — pick the flame, download, rename the 192×192 to icon-180.png and use the same for icon-512.png
- Skip icons entirely for the MVP — iOS will use a screenshot fallback

### Step 3: Initialize git and push to GitHub

In Claude Code:

> Initialize this as a git repo and create a public GitHub repo called macro-tracker. Push the current files.

Claude Code will use `gh` (GitHub CLI) to do this. If you don't have `gh` installed, it'll walk you through.

If you'd rather do it manually:

```bash
git init
git add .
git commit -m "Initial macro tracker"
gh repo create macro-tracker --public --source=. --push
```

### Step 4: Enable GitHub Pages

Two options:

**Via Claude Code:**
> Enable GitHub Pages on the macro-tracker repo, serving from the main branch root.

**Manually:**
1. Go to your repo on github.com
2. Settings → Pages
3. Source: "Deploy from a branch"
4. Branch: `main`, folder: `/ (root)`
5. Save

After ~30 seconds, your app is live at `https://YOUR-USERNAME.github.io/macro-tracker/`

### Step 5: Add to your iPhone home screen

1. Open Safari on your iPhone (must be Safari, not Chrome)
2. Visit your GitHub Pages URL
3. Tap the Share button (square with arrow up)
4. Scroll down → "Add to Home Screen"
5. Name it "Macros" → Add

Tap the icon. It opens fullscreen with no browser chrome, looks/feels native.

## Making future changes

When you want to update:

```bash
cd macro-tracker
claude
```

Then describe what you want changed. Claude Code will edit `index.html`, you commit and push:

```bash
git add . && git commit -m "Add fat tracking" && git push
```

GitHub Pages redeploys automatically in 30 seconds. **Pull-to-refresh in your iPhone app** (or close and reopen) to get the new version.

Your localStorage data (foods, logs) survives updates as long as the URL stays the same.

## Backup your data

Tap the ⚙ icon → Export. Save the JSON file somewhere safe (iCloud Drive, email it to yourself).

To restore: ⚙ → Import → pick the file. Done.

## Troubleshooting

**App icon shows a screenshot instead of the flame icon**
Your `icon-180.png` isn't loading. Check the file exists, is named exactly that, and the URL `https://YOUR-USERNAME.github.io/macro-tracker/icon-180.png` returns the image.

**Changes don't appear on phone**
Force quit the app and reopen, or pull down to refresh inside Safari first to bust the cache.

**Lost my data after switching to a new domain**
localStorage is scoped per-domain. Always use the same URL. If you must move, export first, import after.
