# Matrix Rain HTML Background

A dynamic, configurable Matrix rain effect with 6 visual patterns, real-time controls, autonomous orchestration, **intelligent audio-reactive mode** featuring real-time synesthesia, and **AI integration** that streams LLM responses through the Matrix rain.

**🌐 [LIVE DEMO](https://yufok1.github.io/Matrix-Rain-HTML-Background/)** - Try it now!

## What's New ✨

**Latest Updates** (2025):
- **🌀 Ollama AI Integration**: Stream LLM conversations directly through the Matrix rain
  - Your prompts appear scattered in background rain
  - AI responses stream in dedicated message columns
  - Dynamic speed acceleration during streaming
- **💬 Dual-Layer Visual Dialogue**: Background rain shows YOUR words, message columns show AI responses
- **🇯🇵 Katakana Character Set**: Authentic Japanese characters (アイウエオカキクケコ...)
- **🎨 Enhanced Character Set Selection**: Now 5 character sets including Katakana
- **🔄 WebSocket Bridge**: Python server transparently intercepts and broadcasts Ollama messages

## Features

- **🌀 Ollama AI Integration**: Stream LLM conversations directly through the Matrix rain with visual dialogue
  - **Your prompts** appear scattered in the background rain
  - **AI responses** stream in dedicated message columns with urgency-based effects
  - Automatic speed acceleration during streaming for dynamic loading effect
  - WebSocket bridge connects native Ollama to browser in real-time
- **6 Visual Patterns**: Classic, Rainbow, Pentad, Chaos, Harmonic, Particles
- **🚇 3D Toward Camera Mode**: Characters rush straight at you with parallax depth effect - works with ALL patterns!
- **🎨 Auto-Contrast Background**: Dynamic background automatically contrasts character colors for perfect visibility
- **🎵 Audio Reactive Mode**: Transform sound into visual art with intelligent frequency mapping
- **🎭 Auto Orchestrator**: Autonomous RNG system that continuously evolves the scene every 8-15 seconds
- **⏪ Reverse Flow**: Instantly reverse all animations mid-flow - like hitting rewind!
- **Multi-Directional Rain**: Characters flow up, down, left, right, diagonally, or **toward camera in 3D**
- **Real-time Controls**: Speed, opacity, colors, character sets, direction, intensity, density
- **5 Character Sets**: Matrix, Binary, Hex, Symbols, **Katakana (アイウエオ...)**
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

## Ollama AI Integration 🌀

Turn your Matrix rain into a **visual dialogue system** where conversations with AI become part of the art!

### How It Works

**Dual-Layer Visual Conversation**:
- **Background Rain** (minor portion): Your prompts/questions cycle through as random characters scattered everywhere
- **Message Columns** (major portion): AI responses stream character-by-character in dedicated columns with urgency-based effects

**Urgency-Based Behavior**:
- **Ambient (0-2)**: Slow downward flow, subtle appearance
- **Normal (3-5)**: Moderate speed, varied directions
- **Emphasis (6-7)**: Faster movement, upward for questions
- **Urgent (8-10)**: Fast downward, high contrast, critical messages

**Smart Features**:
- Auto-contrast background adjusts to ensure message visibility
- Messages loop continuously until next response arrives
- Speed acceleration during streaming creates dynamic loading effect
- WebSocket bridge intercepts Ollama API calls transparently

### Ollama Setup

**Prerequisites**:
1. **Python 3.7+** installed
2. **Ollama** installed and running ([ollama.com](https://ollama.com))
3. Python packages: `pip install -r requirements.txt`

**How to Use**:
1. Run `START.bat` (launches everything automatically)
2. Click **🌀 OLLAMA MODE** button in the interface
3. Open your native Ollama app or use the Ollama API
4. Send a message to any model (llama2, mistral, etc.)
5. Watch:
   - Your prompt appears scattered in background rain
   - AI response streams in dedicated columns
   - Rain speeds up during streaming, then normalizes

**Technical Architecture**:
- `websocket_bridge.py` runs dual servers:
  - HTTP Proxy (port 11434) → intercepts Ollama API calls
  - WebSocket Server (port 8080) → broadcasts to browser
- Native Ollama runs on port 11435
- Browser connects to WebSocket for real-time message display
- Your prompts and AI responses both visible simultaneously

**Note**: The bridge is transparent - your native Ollama app works normally, the Matrix rain just "listens" and displays the conversation!

## Usage

### Basic Setup
1. **Run `START.bat`** - Clears cache, kills old processes, launches server and browser
2. **Press M** - Toggle settings modal on/off
3. **Click pattern buttons** - Instantly switch between patterns

### Controls
- **🌀 OLLAMA MODE** - Enable AI conversation visualization (requires Ollama + Python bridge)
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

### Character Sets
- **Matrix**: A-Z, 0-9, special symbols (@#$%^&*)
- **Binary**: 0 and 1 only
- **Hexadecimal**: 0-9, A-F
- **Symbols**: Full symbol set (@#$%^&*()_+-=[]{}|;:,.<>?)
- **Katakana**: Authentic Japanese characters (アイウエオカキクケコ...)
- Audio Reactive Mode automatically cycles through character sets based on high frequency content

### Ollama Integration Architecture
- **Python WebSocket Bridge** (`websocket_bridge.py`):
  - HTTP Proxy intercepts Ollama API calls transparently
  - WebSocket server broadcasts to browser clients
  - Urgency detection analyzes message content
  - Dual-port system (11434 proxy, 8080 WebSocket)
- **Browser Client**:
  - Dual-canvas system (background rain + message layer)
  - Auto-contrast background for message visibility
  - Column reservation system (background rain skips Ollama columns)
  - Character-by-character streaming display
- **Dependencies**: Python 3.7+, websockets>=12.0, aiohttp>=3.9.0

### Browser Requirements
- **Chrome or Edge** (for audio capture via getDisplayMedia)
- Desktop audio sharing capability
- No extensions needed
- WebSocket support (all modern browsers)

## Troubleshooting

### General Issues
- **Page won't load?** Close all old tabs, run `START.bat` again
- **Changes not appearing?** `START.bat` includes cache-busting - force refresh if needed
- **Server issues?** Batch file kills old Python processes automatically

### Audio Reactive Mode
- **Audio not working?** Make sure you checked "Share audio" when selecting the tab
- **No color changes in audio mode?** Verify Classic pattern is selected (forced in audio mode)

### Ollama Integration
- **Ollama Mode button not working?**
  - Check Python dependencies: `pip install -r requirements.txt`
  - Verify Ollama is installed and running on port 11435
  - Run `START.bat` to launch all servers automatically
- **Messages not appearing?**
  - Check browser console for WebSocket connection status
  - Verify WebSocket bridge is running (should see "🌀 WebSocket server started")
  - Try clicking Ollama Mode button to reconnect
- **Native Ollama app not responding?**
  - Ensure Ollama is running on port 11435 (not default 11434)
  - Restart `START.bat` to reset port configuration
- **Background rain shows random characters instead of my prompt?**
  - This is normal when no message has been sent yet
  - Send your first message and it will appear in the background

## Keyboard Shortcuts

- **M** - Toggle settings modal

## Project Files

- **matrix-rain-utility-suite.html**: Main application with all features (Ollama, audio, patterns)
- **index.html**: Simplified version for GitHub Pages (no Ollama integration)
- **websocket_bridge.py**: Python WebSocket bridge server for Ollama integration
- **test-interface.html**: Testing tool for sending manual messages to the Matrix rain
- **START.bat**: Windows launcher script (kills old processes, starts servers, opens browser)
- **requirements.txt**: Python dependencies (websockets, aiohttp)
- **README.md**: This documentation
- **LICENSE**: MIT License

## Demo Videos

Watch the audio reactive mode in action:
- Movie dialogue: Each character speaks in their own color!
- Music: Bass drums pulse the speed, melodies paint the rainbow
- Syllables trigger instant flow reversals with every word

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
