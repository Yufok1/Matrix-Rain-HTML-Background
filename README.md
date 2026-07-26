# Matrix Rain HTML Background

A configurable Matrix rain effect in a **single self-contained HTML file** — 6 visual patterns, a 3D toward-camera mode, an autonomous orchestrator, and an audio-reactive synesthesia engine that maps live sound onto colour, speed and motion.

**🌐 [LIVE DEMO](https://yufok1.github.io/Matrix-Rain-HTML-Background/)**

No build step, no dependencies, no CDN, no network calls. Open the file and it runs — including from `file://`.

---

## Quick start

Download `matrix-rain-utility-suite.html` and open it. That's it.

The control panel starts **minimized** as a small bar in the top-right corner. Click it — or press **`M`** — to open it.

---

## Controls

**Keyboard** — `M` toggles the control panel. *(It also fires while you're typing in the custom-characters box, so the panel will vanish if you type an "m" there. Press `M` again to bring it back.)*

**Mouse** — click controls normally; the mouse wheel scrolls the panel; dragging near the panel's right edge also scrolls it.

### Buttons

| Button | What it does |
|---|---|
| **Toggle Matrix Rain** | Start / stop the animation |
| **Emergency Stop** | Halt everything immediately |
| **⏪ Reverse Flow** | Flip the direction of motion mid-flight |
| **🌀 Chaos Once** | Randomize every parameter a single time |
| **🎭 Auto Orchestrator** | Autonomously evolve the scene every 8–15 seconds |
| **🎵 Audio Reactive Mode** | Drive the visuals from live audio |
| **Hard Refresh** | Reload the page back to defaults |

Auto Orchestrator and Audio Reactive Mode are **mutually exclusive** — enabling one greys out the other.

### Sliders

| Control | Range | Default |
|---|---|---|
| Rain Speed | 1–100 (right = faster) | 35 |
| Intensity | 1–100 | 70 |
| Density | 1–100 | 100 |
| Character Size | 1–100, with `−` / `+` buttons | 10 |

---

## Patterns

| Pattern | Effect |
|---|---|
| **Classic Matrix** | Traditional green cascade |
| **Rainbow Spectrum** | Cycling multi-colour waves |
| **Pentad Prism** | Five-colour rotation across columns |
| **Chaos Flow** | Turbulent hue drift with positional jitter |
| **Harmonic Waves** | Sine-wave interference offsets |
| **💫 Particles** | Centre-attracted orbital particle field |

## Directions

`Down` · `Up` · `Left` · `Right` · `Diagonal` · **`🚇 Toward Camera (3D)`**

Toward Camera is a *direction*, but it takes over rendering entirely: a depth-sorted tunnel with parallax, per-character speed variation and aggressive 0.1×→3.6× scaling. It works with every pattern.

## Character sets

`Matrix (A-Z, 0-9, @#$)` · `Binary (01)` · `Hexadecimal (0-F)` · `Symbols (@#$%^&*)` · `Katakana (アイウエオ...)` · `Custom`

Choosing **Custom** reveals a text field — whatever you type becomes the character pool, live.

---

## Audio Reactive Mode 🎵

Sound is decomposed into frequency bands, and each band drives exactly one visual parameter:

| Band | Drives |
|---|---|
| **Bass** | Speed — kick drums accelerate the rain |
| **Low-mid** | Hue (30% weight) |
| **Mid** | Hue (70% weight) — melody and vocals paint the colour |
| **High** | Hue modulation, and which character set is active |
| **Volume** | Intensity and lightness |
| **Peaks** | Direction changes |

The secondary colour is always held at the complement of the primary, so the palette stays balanced as the hue sweeps. A syllable detector watches the mid/high bands and can flip the flow on each detected syllable.

### Getting audio in

Click Audio Reactive Mode, pick the tab or screen playing your audio, and **tick "Share audio"** in the picker. Chrome or Edge required (`getDisplayMedia` audio capture).

### While audio mode is running

- The pattern is **forced to Classic** — it's the only one whose colours aren't already driven by the pattern itself, so it's the only one where the audio's colour response is visible.
- Speed, intensity, hue, character set and direction are all driven by the audio; your manual settings for those are overridden until you turn it off.
- The Secondary Colour picker is disabled, since it's computed.
- **Density is never touched** — it stays fully manual.

### Audio sub-controls

- **Reverse on syllable** — off by default. When on, every detected syllable flips the flow.
- **Diagonals** — on by default. Allows diagonal directions in the audio-driven direction changes.
- **Hue Reactivity / Saturation Gain / Brightness Depth** — 50–200% each, scaling how far the audio can push hue, saturation and lightness.

### Colour presets

`Neon` · `Prism` · `Pastel` · `Hyperneon` · `Aurora` · `Bassstorm` · `Crystal` · `Vaporwave` · `Inferno` · `Zen`

Each preset retunes saturation floor, lightness bounds, hue spread and the three reactivity scales together. **They only affect audio-reactive colour response** — with audio mode off, they do nothing.

---

## Auto Orchestrator 🎭

Autonomous mode. Every 8–15 seconds it randomizes pattern, both colours, speed, intensity, character set and direction. It deliberately leaves **density** and **reverse flow** alone, so you keep control of the overall look while it improvises everything else.

---

## Notes & limitations

- **Nothing persists.** There is no `localStorage` — every reload returns to the defaults (Classic / Down / speed 35 / intensity 70 / density 100 / size 10 / `#00ff41` + `#00cc33`).
- **Chromium recommended.** Slider and scrollbar styling leans on `-webkit-` pseudo-elements, and browser audio capture needs Chrome or Edge. Firefox renders the rain fine, but the panel looks plainer and there is no audio mode.
- Rendering is canvas 2D on a `setInterval` loop, so it is not vsync-aligned.
- **Diagnostics are off by default.** Set `DEBUG = true` near the top of the `<script>` block to surface the internal log in the browser console.

---

## Project files

| File | Purpose |
|---|---|
| `matrix-rain-utility-suite.html` | The application — everything is in here |
| `index.html` | Identical copy, serving the GitHub Pages demo |
| `LICENSE` | MIT |

---

## License

MIT — see [LICENSE](LICENSE).
