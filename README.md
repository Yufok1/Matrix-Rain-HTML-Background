# Matrix Rain HTML Background

A dynamic, configurable Matrix rain effect with 6 visual patterns, real-time controls, autonomous orchestration, and **intelligent audio-reactive mode** featuring real-time synesthesia.

**🌐 [LIVE DEMO](https://yufok1.github.io/Matrix-Rain-HTML-Background/)** - Try it now!

## Features

- **6 Visual Patterns**: Classic, Rainbow, Pentad, Chaos, Harmonic, Particles
- **🚇 3D Toward Camera Mode**: Characters rush straight at you with parallax depth effect - works with ALL patterns!
- **🎨 Auto-Contrast Background**: Dynamic background automatically contrasts character colors for perfect visibility
- **🎵 Audio Reactive Mode**: Transform sound into visual art with intelligent frequency mapping
- **🎭 Auto Orchestrator**: Autonomous RNG system that continuously evolves the scene every 8-15 seconds
- **⏪ Reverse Flow**: Instantly reverse all animations mid-flow - like hitting rewind!
- **Multi-Directional Rain**: Characters flow up, down, left, right, diagonally, or **toward camera in 3D**
- **Real-time Controls**: Speed, opacity, colors, character sets, direction, intensity, density
- **🌀 Chaos Randomizer**: One-time randomization of all parameters
- **⌨️ Keyboard Shortcut**: Press **M** to toggle settings (prominently displayed in UI)
- **Activity Feed**: Real-time log of all parameter changes

## Audio Reactive Mode 🎵

Transform your desktop audio into a living visual experience! The rain becomes a **real-time synesthesia engine** where sound paints color and motion.

### How It Works

**Intelligent Frequency Mapping** - Each audio frequency range controls ONE specific visual parameter:

- **BASS (0-80Hz)** → **Speed** - Drum kicks make the rain faster
- **LOW-MID (80-200Hz)** → **Color Hue** - Vocal timbre and music body paint the color wheel (0-360°)
- **MID (200-600Hz)** → **Density** - Melody/vocals control the amount of rain
- **HIGH (600+Hz)** → **Character Set** - Treble frequencies pick which symbols appear
- **VOLUME (Overall)** → **Intensity** - Loudness equals brightness
- **AUDIO PEAKS** → **Direction** - Musical events change flow direction

**Syllable Detection** - Flow reversals sync with speech:
- Each spoken/sung syllable triggers an instant flow reversal
- ~8 syllables/second detection rate
- During instrumental sections, beats take over reversal duty (backup system)

**Real-Time Synesthesia**:
- Each voice has a unique color signature based on vocal characteristics
- Different instruments map to different colors
- Complementary color pairs update continuously
- Watch repeating notes paint the same color each time!

### Audio Mode Setup

1. **Enable Audio Reactive Mode** button (requires Chrome/Edge)
2. Browser will prompt: "Share your screen"
3. **Select the tab** playing your movie/music
4. ✅ **CHECK "Share audio"** - CRITICAL!
5. Click Share
6. Watch the magic happen!

**Works Best With**:
- Movie dialogue (each actor gets their own color!)
- Music with clear vocals
- Electronic/EDM (bass → speed spikes)
- Classical (each instrument section = different palette)
- Any audio with rhythm and melody

**Note**: Audio mode locks to **Classic pattern** so color changes are visible (no pattern-based colors interfering).

## Usage

### Basic Setup
1. **Run `START.bat`** - Clears cache, kills old processes, launches server and browser
2. **Press M** - Toggle settings modal on/off
3. **Click pattern buttons** - Instantly switch between patterns

### Controls
- **⏪ REVERSE FLOW** - Instantly reverse all motion (rain flows backward!)
- **🎭 AUTO ORCHESTRATOR** - Start autonomous scene evolution (8-15 sec intervals)
- **🌀 CHAOS ONCE** - Randomize all parameters once
- **🎵 AUDIO REACTIVE MODE** - Sync visuals with desktop audio
- **Sliders** - Fine-tune speed, density, opacity, intensity, colors, character sets, direction

## Patterns

- **Classic**: Traditional Matrix rain - REQUIRED for audio mode (shows color changes)
- **Rainbow**: Multi-color spectrum waves
- **Pentad**: Five-color prismatic effect
- **Chaos**: Turbulent multi-directional flow
- **Harmonic**: Wave-based interference patterns
- **Particles**: Floating particle field

## Directions

- **Down**: Traditional downward flow
- **Up**: Upward cascade
- **Left**: Horizontal left flow
- **Right**: Horizontal right flow
- **Diagonal**: Diagonal flow
- **🚇 Toward Camera (3D)**: Characters rush straight at you with parallax depth effect, aggressive scaling (0.1x → 3.6x), individual speed variations, and animated character morphing. Works with ALL patterns!

## Technical Details

### Audio Analysis
- 60fps frequency analysis using Web Audio API
- FFT size: 2048
- Frequency bins: 1024
- Real-time frequency band averaging (bass/low-mid/mid/high)
- Dual detection systems: syllables (120ms cooldown) + beats (150ms cooldown)
- HSL color space for smooth hue transitions

### Browser Requirements
- **Chrome or Edge** (for audio capture via getDisplayMedia)
- Desktop audio sharing capability
- No extensions needed

## Troubleshooting

- **Page won't load?** Close all old tabs, run `START.bat` again
- **Changes not appearing?** `START.bat` includes cache-busting - force refresh if needed
- **Server issues?** Batch file kills old Python processes automatically
- **Audio not working?** Make sure you checked "Share audio" when selecting the tab
- **No color changes in audio mode?** Verify Classic pattern is selected (forced in audio mode)

## Keyboard Shortcuts

- **M** - Toggle settings modal

## Demo Videos

Watch the audio reactive mode in action:
- Movie dialogue: Each character speaks in their own color!
- Music: Bass drums pulse the speed, melodies paint the rainbow
- Syllables trigger instant flow reversals with every word

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
