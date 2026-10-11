# Matrix Rain HTML Background

Matrix rain with six visual patterns, audio reactivity, and a 3D camera you can look around. Streams turn along the X, Y and Z axes while their fading characters stay where they were drawn, leaving connected trails through a repeating volume. The background stays black.

**[Open the live preview](https://yufok1.github.io/Matrix-Rain-HTML-Background/)** · **[Download the source ZIP](https://github.com/Yufok1/Matrix-Rain-HTML-Background/archive/refs/heads/master.zip)**

The preview runs the same application as `matrix-rain-utility-suite.html`. No build step, third-party libraries, CDN, or account required.

## Quick start

Use the live preview, or download and extract the complete ZIP. Keep the HTML, camera scripts and `trails/` folder together. From that folder, start a local server:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Open [http://127.0.0.1:8000/](http://127.0.0.1:8000/) in your browser. Use HTTP/HTTPS rather than opening the HTML directly: the trail controls load as JavaScript modules.

Click **M +** in the top-right corner to open settings. **M** also toggles the panel. The shortcut currently fires inside text inputs too; use the button while editing custom characters.

## 3D camera and trails

The camera starts **enabled**, facing forward. **Slow orbit** rotates the view; **Look around** and **Look up / down** let you set the orientation yourself. **Original View** returns to the original canvas renderer. Recheck **Enable camera** to return to 3D.

- **Down / Up / Left / Right / Toward Camera / Away from Camera** use the same stream positions. Turning leaves existing characters in place, so the next segment joins the previous trail.
- Characters at different depths have different apparent sizes. Toward/away movement grows or shrinks them through perspective.
- The world repeats across its faces, including during orbit, keeping the surrounding rain visible as the view turns.
- **Variable tail lengths** gives each stream a stable length. Defaults are **12–100 characters**; both bounds can be adjusted between **12 and 160**.
- Turning off variable lengths restores the original 3D fade. These controls affect the camera renderer; Original View keeps its canvas fade.

Trail length preferences are saved locally. The remaining controls reset when the page reloads.

## Visual controls

| Control | Range / options | Initial value |
|---|---|---|
| Density | 1–100% | **50%** |
| Rain Speed | 1–100; higher slider values are faster | Slider: 35 |
| Intensity | 1–100 | 70 |
| Character Size | 1–100, with − / + buttons | 10 |
| Primary / Secondary Color | Color pickers | `#00ff41` / `#00cc33` |
| Camera | Enable, slow orbit, yaw and pitch | Enabled; orbit off |
| Shortest / Longest tail | 12–160 characters | **12 / 100** |

**Patterns:** Classic Matrix, Rainbow Spectrum, Pentad Prism, Chaos Flow, Harmonic Waves, and Particles.

**Character sets:** Matrix, Binary, Hexadecimal, Symbols, Katakana, or Custom. Choosing Custom reveals a text field for your own character pool.

**Reverse Flow** manually reverses motion. **Chaos Once** randomizes the scene once. **Auto Orchestrator** changes patterns, colors and movement every 8–15 seconds while leaving density and manual reverse under your control. Auto Orchestrator and Audio Reactive Mode run separately.

## Audio reactive mode

In Chrome or Edge, click **Audio Reactive Mode**, choose the tab or screen playing sound, and enable **Share audio** in the browser's picker. Which sources offer audio depends on your browser and platform. Audio access starts only after you click the button and approve sharing. The screen track required by the capture API is not displayed or recorded by this application.

| Audio | Visual response |
|---|---|
| Bass | Rain speed |
| Low-mid and mid frequencies | Hue |
| High frequencies | Hue variation and character set |
| Volume | Intensity and brightness |
| Changing energy | Direction |

Audio mode uses Classic Matrix and controls its colors, speed, intensity, character set and direction. Density stays manual. Secondary color follows the complement of the primary color.

**Depth** is on by default and includes toward/away movement in the audio direction pool. Turn it off for the four planar headings. Audio-driven turns cannot immediately select the opposite heading, reducing the back-and-forth wavering over the same line. Pauses keep the last heading, and direction changes share a minimum 240 ms interval. Manual Reverse Flow still works.

**Beat turns** is optional and off by default. It adds right-angle turns on detected syllables or bass beats instead of reversing a stream onto itself.

**Hue Reactivity / Saturation Gain / Brightness Depth** each range from 50–200%. Color presets: Neon, Prism, Pastel, Hyperneon, Aurora, Bassstorm, Crystal, Vaporwave, Inferno, and Zen.

The runtime also supports Wallpaper Engine's built-in audio listener when hosted there; browser sharing is used for this live preview. Speech recognition is not included.

## Compatibility

The 3D camera needs WebGL with instanced rendering. Chrome or Edge is recommended for the browser audio mode. No microphone, speech model, or companion app is needed. Longer trails and higher density increase rendering load.

## Project files

| File | Purpose |
|---|---|
| `matrix-rain-utility-suite.html` | Main application and controls |
| `index.html` | Synchronized copy used by GitHub Pages |
| `rain-camera.js` | Camera orientation, repeating volume, and historical trail positions |
| `rain-camera-gpu.js` | Instanced WebGL glyph renderer |
| `trails/rain-trails.js` | Trail controls and saved preferences |
| `trails/rain-trail-lengths.js` | Stable per-stream lengths and fade |
| `tests/` | Runtime packaging, direction behavior, and trail checks |

For development, Node.js 18+ can run the checks without installing packages:

```sh
npm test
```

After editing the main HTML, run `npm run sync-demo` to update `index.html`. The tests catch a stale demo copy or missing runtime files. GitHub Pages publishes the root of `master` at the live preview link above.

## License

MIT — see [LICENSE](LICENSE).
