# Loaves and Fish · Social Studio

Browser app that turns a photo or video into branded posts and reels for Loaves and Fish Art Studio. Nothing is uploaded: all rendering happens on your device.

## Use
1. Drop photos or videos (several photos = one carousel set).
2. Pick a template: Spotlight, Polaroid, Photo → Ink, Ink frame, Clean reel.
3. Edit callouts, toggle quick callouts (max 4), drag the preview to reposition, scroll to zoom.
4. Tick the sizes, then **Download images** (JPG/PNG, ZIP when more than one) or **Render reel / video** (MP4, ZIP when more than one).
   - Photos render as a moving reel (slow zoom, animated callouts, end card).
   - Video renders in real time: keep the tab visible.
   - Use Chrome or Safari on Mac for H.264 MP4. Firefox records WebM, which Instagram rejects.

## Sizes
| Size | Pixels | Use |
|---|---|---|
| Instagram feed 3:4 | 1080×1440 | Instagram feed, carousels |
| Portrait 4:5 | 1080×1350 | Scheduled/boosted Instagram, Facebook, Threads |
| Square 1:1 | 1080×1080 | Facebook, LinkedIn, WhatsApp catalogue |
| Reel / Story 9:16 | 1080×1920 | Reels, Stories, YouTube Shorts, WhatsApp Status |
| Pinterest 2:3 | 1000×1500 | Pinterest |
| Landscape 16:9 | 1920×1080 | YouTube, X, LinkedIn |

## Deploy (GitHub Pages)
```bash
cd lf-social-studio
git init -b main && git add . && git commit -m "Social Studio"
gh repo create Loavesandfishart/social-studio --public --source . --push
gh api -X POST repos/Loavesandfishart/social-studio/pages -f "source[branch]=main" -f "source[path]=/"
```
Live at `https://loavesandfishart.github.io/social-studio/`.

## Files
`index.html` UI · `style.css` brand styling (tokens from loavesandfish.in) · `app.js` templates, rendering, export · `assets/` logos.
Edit preset callouts in `PRESET_CHIPS` and sizes in `FORMATS` at the top of `app.js`.
