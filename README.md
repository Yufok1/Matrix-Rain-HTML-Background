# Matrix Rain Omni

Connected Matrix rain trails through a repeating 3D world, with audio-driven motion and colors. Characters turn along the X, Y and Z axes; each old letter keeps its position and birth color until it blinks out. The background is black.

**[Try the live demo](https://yufok1.github.io/Matrix-Rain-HTML-Background/)** · **[Download the complete source](https://github.com/Yufok1/Matrix-Rain-HTML-Background/archive/refs/heads/master.zip)** · **[Wallpaper Engine Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3599704378)**

The live demo and `matrix-rain-utility-suite.html` are the same application. Runtime assets are bundled; no account, CDN, or companion app is needed.

## Controls

Click the small 3D arrow in the upper-right corner, or press **M**, to open settings. Escape collapses them. Shortcuts leave text fields alone. Drag the header to move the panel. On phones, the collapsible categories occupy the lower portion of the screen so the rain stays visible.

The 3D arrow has a solid pyramid head with flat cel shading, outlined edges and a tiny tapered jet exhaust. Its hue complements the rain's current color. It stays dim during playback and brightens on hover or keyboard focus. It snaps against the rain’s actual heading, including reverse flow, and uses the rain camera's perspective from its position in the corner. Audio accents strengthen the exhaust; travel speed adds a restrained edge glow. A gentle hover and bank keep it visible during steady rain; the click target stays fixed. It shares the rain’s render clock and audio analysis, stops with the session, and disables idle motion and audio effects when reduced motion is requested.

The header has **Stop / Resume** to preserve the current session and **Reset** to restore defaults. Stop pauses rain, camera, audio analysis and auto scenes. Resume keeps your settings; Reset releases any browser audio share and restarts manual rain. An expired browser share must be reconnected.

- **Rain:** density, size, manual patterns, characters, direction, reverse flow, one-time shuffle and auto scenes. Camera trails have stable, varied lengths and stepped digital fading. Defaults: 50% density and 12–100-character trails.
- **Audio response:** start audio, choose a palette and adjust color fluctuation, hue range, saturation and brightness. Beat turns allows musical attacks to steer immediately; off waits for a sustained change. Accents still affect speed in either mode.
- **Camera:** enable perspective, choose Fixed, Showcase, Corkscrew or Gyroscope, and adjust orientation and motion speed. Each animated mode keeps its own calibrated 0–100% speed, default 25%. Zero holds the view while rain continues. Disable camera for uniform-sized, four-direction original rain.
- **Rendering:** quality, sharp glyphs, smooth motion, glow and contrast. Lower quality, density and trail length reduce drawing work.
- **Configurations:** export every visual setting into an **MR3** copy/paste code, then import it on another compatible version. Import validates the complete code before applying it and leaves listening, pause and auto-scene activation alone. MR1/MR2 codes are migrated. See [settings coverage](SETTINGS-AUDIT.md).

Audio motion responds to new spectral content and evolving layers, with restrained rapid backtracking rather than a scheduled turn cycle. Color responds primarily to midrange shape and dynamics; it does not isolate vocals or recognize words. A cohesive palette is assigned to newly born characters. Existing trails keep their colors, so changes travel through the rain instead of recoloring the whole screen. Fluctuation sensitivity starts at 100%; 500% detects much smaller changes.

## Audio and platforms

**Wallpaper Engine:** uses the built-in desktop audio listener. No microphone or media-access setting is needed for reactivity. In Configurations, **Paste code** reads the clipboard when the host permits it; **Import** applies the validated code. If the desktop host denies clipboard reading, paste into the **Configuration code** field on the Wallpaper Engine Installed tab, then click Import in the wallpaper. This field uses Wallpaper Engine’s documented text user property and needs no companion app.

**Desktop browser:** use a compatible Chrome/Edge screen or tab share with audio. The browser requires a screen/video track for this API; this application only analyzes the audio and saves/uploads nothing. Unsupported browsers have the audio controls disabled. Phones can view the demo, but browser system-audio sharing may be unavailable.

Desktop Gyroscope is an animated camera path. Desktop builds do not read motion sensors, camera hardware or GPS. The separate native Android APK retains its phone-output audio route and optional sensor-based Phone motion view. Speech recognition and microphone routes are not included.

## Run locally

Extract the **whole** source archive, keeping the scripts, `assets/` and `trails/` together. Serve the folder:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Open http://127.0.0.1:8000/. Use HTTP/HTTPS rather than opening the HTML as a file, because the controls load JavaScript modules. The camera uses instanced WebGL; the original canvas view remains available. Longer trails and higher density cost more GPU work.

## Development

Node.js 18+ can run the checks without installing packages:

```sh
npm test
npm run sync-demo
```

`index.html` must stay identical to the main HTML. GitHub Pages serves the root of `master`. Changed runtime resources have content-hash URLs to avoid mixing cached versions in embedded browsers. Tests cover bundled paths, deterministic steering, color response, immutable birth colors, calibrated cameras, rendering, settings validation and legacy configuration migration.

`rain-audio-choreography.js` and `beat-turns-policy.js` govern audio motion; `rain-audio-color.js` governs the palette; `rain-camera.js` and `rain-camera-gpu.js` preserve and draw world trails. The settings codec, sharing, session and UI modules manage the panel; `rain-settings-beacon.js` draws its pointer launcher without a second WebGL context. Modules named `choreography-preview.js` and `color-preview.js` now wire only the approved controllers; no development comparison switches are exposed.

## License

MIT — see [LICENSE](LICENSE). Bundled font assets use the SIL Open Font License 1.1. Font credits, MSDF shader attribution and notices are in [assets/THIRD-PARTY.md](assets/THIRD-PARTY.md).
