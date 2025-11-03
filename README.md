# Matrix Rain HTML Background

A dynamic, configurable Matrix rain effect with 6 visual patterns, real-time controls, autonomous orchestration, **intelligent audio-reactive mode** featuring real-time synesthesia, and **AI integration** that streams LLM responses through the Matrix rain. (backend required for the Ollama integration)

**🌐 [LIVE DEMO](https://yufok1.github.io/Matrix-Rain-HTML-Background/)** - Try it now!

## What's New ✨

**Latest Updates** (2025):
- **🌀 Full-Screen Ollama Integration**: AI responses stream across 100% of screen in Matrix rain style
  - Random vibrant colors per message (10-color palette)
  - Automatic pattern cycling (classic, rainbow, pentad, harmonic)
  - Pattern-specific rendering effects (color waves, sinusoidal motion)
  - **Exclusive mode system**: Only one mode active at a time (prevents buggy interactions)
- **🎨 Enhanced Character Sets**: Now 6 character sets including Katakana and Custom user-defined
- **🇯🇵 Katakana Character Set**: Authentic Japanese characters (アイウエオカキクケコ...)
- **✏️ Custom Character Set**: Define your own characters in real-time
- **🔄 WebSocket Bridge**: Python server transparently intercepts and broadcasts Ollama messages
- **🎯 Smooth Rendering**: Integer-based positioning eliminates character jitter during message flow

## Features

- **🌀 Ollama AI Integration**: Stream LLM conversations directly through the Matrix rain with visual dialogue
  - **AI responses** stream across ALL columns (full-screen, 100% of screen width)
  - Random vibrant colors per message (10-color palette: red, magenta, cyan, yellow, green, orange, purple, mint, pink, lime)
  - Automatic pattern cycling (classic, rainbow, pentad, harmonic) with pattern-specific rendering
  - **Exclusive mode**: Only one mode (Ollama/Audio/Orchestrator) can be active at a time
  - WebSocket bridge connects native Ollama to browser in real-time
- **6 Visual Patterns**: Classic, Rainbow, Pentad, Chaos, Harmonic, Particles
- **🚇 3D Toward Camera Mode**: Characters rush straight at you with parallax depth effect - works with ALL patterns!
- **🎨 Auto-Contrast Background**: Dynamic background automatically contrasts character colors for perfect visibility
- **🎵 Audio Reactive Mode**: Transform sound into visual art with intelligent frequency mapping
- **🎭 Auto Orchestrator**: Autonomous RNG system that continuously evolves the scene every 8-15 seconds
- **⏪ Reverse Flow**: Instantly reverse all animations mid-flow - like hitting rewind!
- **Multi-Directional Rain**: Characters flow up, down, left, right, diagonally, or **toward camera in 3D**
- **Real-time Controls**: Speed, colors, character sets, direction, intensity, density
- **6 Character Sets**: Matrix, Binary, Hex, Symbols, **Katakana (アイウエオ...)**, **Custom (user-defined)**
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

**Full-Screen LLM Message Display**:
- **Background Rain Layer**: Shows random matrix characters as background ambiance
- **Message Canvas Layer**: AI responses stream across ALL columns (100% of screen) with focused message rendering
- Each message gets a random vibrant color from 10-color palette (red, magenta, cyan, yellow, green, orange, purple, mint, pink, lime)
- Automatic pattern cycling: Messages render with pattern-specific effects (rainbow color waves, pentad 5-color rotation, harmonic sinusoidal motion)
- **Pattern Randomization**: Automatically cycles through compatible patterns (classic, rainbow, pentad, harmonic) - excludes particles and chaos
- Messages loop continuously until next response arrives, creating immersive flowing text

**Exclusive Mode System**:
- Only one mode (Ollama/Audio Reactive/Auto Orchestrator) can be active at a time
- When one mode is active, other mode buttons are disabled (grayed out)
- Prevents buggy interactions between multiple modes

**Smart Features**:
- Auto-contrast background adjusts to ensure message visibility
- Messages loop continuously until next response arrives
- Speed acceleration during streaming creates dynamic loading effect
- WebSocket bridge intercepts Ollama API calls transparently

### Ollama Setup

**Prerequisites**:
1. **Python 3.7+** installed ([python.org](https://www.python.org/downloads/))
2. **Ollama** installed ([ollama.com](https://ollama.com))
3. **Python packages** - Install dependencies:
   ```bash
   # Open Command Prompt in the project folder and run:
   pip install -r requirements.txt
   ```
   This installs: `websockets>=12.0` and `aiohttp>=3.9.0`

**Configuration (Optional)**:
If your Ollama models are stored in a **custom location** (not the default C: drive):
1. Open Command Prompt as Administrator
2. Run: `setx OLLAMA_MODELS "D:\ollama\models"` (replace with your path)
3. Restart your terminal/command prompt
4. `START.bat` will automatically detect and use your custom path

*Note: Most users can skip this - Ollama uses `C:\Users\<YourName>\.ollama\models` by default*

**How to Use**:
1. **Run `START.bat`** - Script will automatically request admin privileges
   - Stops any running Ollama service
   - Launches Ollama server on port 11435
   - Starts proxy on port 11434 to intercept API calls
2. **If Ollama doesn't stop automatically**: Manually close it first
   - Right-click Ollama tray icon → "Quit Ollama"
   - Then run START.bat again
3. Click **🌀 OLLAMA MODE** button in the interface
4. Open your native Ollama app or use the Ollama API
5. Send a message to any model (llama2, mistral, etc.)
6. Watch:
   - **AI response** streams across ALL columns (full-screen message display)
   - Each message displays in a random vibrant color with pattern-specific rendering effects
   - Patterns automatically cycle (classic, rainbow, pentad, harmonic) for visual variety
   - Messages loop continuously until next response
   - Background rain provides ambient visual effects

**Technical Architecture**:
- `websocket_bridge.py` runs dual servers:
  - HTTP Proxy (port 11434) → intercepts Ollama API calls
  - WebSocket Server (port 8080) → broadcasts to browser
- Native Ollama runs on port 11435
- Browser connects to WebSocket for real-time message display
- AI responses rendered full-screen with random colors and pattern-specific visual effects
- Pattern randomization system automatically cycles through compatible visual modes

**Note**: The bridge is transparent - your native Ollama app works normally, the Matrix rain just "listens" and displays the conversation!

## Usage

### Basic Setup
1. **Run `START.bat`** - Launches all servers and opens browser (requests admin automatically)
   - Stops Ollama service, starts Ollama on port 11435, proxy on port 11434
2. **If needed**: Manually close Ollama first if batch file can't stop it
3. **Press M** - Toggle settings modal on/off
4. **Click pattern buttons** - Instantly switch between patterns

### Controls
- **🌀 OLLAMA MODE** - Enable AI conversation visualization (requires Ollama + Python bridge)
- **⏪ REVERSE FLOW** - Instantly reverse all motion (rain flows backward!)
- **🎭 AUTO ORCHESTRATOR** - Start autonomous scene evolution (8-15 sec intervals)
- **🌀 CHAOS ONCE** - Randomize all parameters once
- **🎵 AUDIO REACTIVE MODE** - Sync visuals with desktop audio
- **Sliders** - Fine-tune speed, density, intensity, colors, character sets, direction
- **Custom Characters** - Input field to define your own character set in real-time

**Note**: Only one mode (Ollama/Audio Reactive/Auto Orchestrator) can be active at a time. When one mode is enabled, the other mode buttons will be grayed out and disabled to prevent conflicts.

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
- **Custom**: User-defined character set - enter any characters you want in the input field
- Audio Reactive Mode automatically cycles through character sets based on high frequency content

### Ollama Integration Architecture
- **Python WebSocket Bridge** (`websocket_bridge.py`):
  - HTTP Proxy intercepts Ollama API calls transparently
  - WebSocket server broadcasts to browser clients
  - Dual-port system (11434 proxy, 8080 WebSocket)
- **Browser Client**:
  - Dual-canvas system (background rain + message layer)
  - Full-screen message rendering (100% of columns)
  - Random color selection per message (10-color palette)
  - Pattern-specific rendering (rainbow waves, pentad rotation, harmonic sinusoidal motion)
  - Automatic pattern cycling through compatible modes
  - Auto-contrast background for message visibility
  - Character-by-character streaming display with smooth integer-based positioning
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

- **Port conflict error (OSError [Errno 10048])?** - MOST COMMON ISSUE
  - **Problem**: Ollama is already running on port 11434
  - **Solution**: The batch file should stop it automatically with admin rights
    - If it doesn't work: Manually close Ollama first
      1. Right-click Ollama tray icon (system tray, bottom right)
      2. Click "Quit Ollama"
      3. Run `START.bat` again
  - **Why this happens**: The script needs to move Ollama to port 11435 so the proxy can use 11434
  - If you see "only one usage of each socket address is normally permitted" - this is the issue!

- **Python dependencies not installed?**
  - Error: "No module named 'websockets'" or "No module named 'aiohttp'"
  - **Solution**: Open Command Prompt in project folder and run:
    ```bash
    pip install -r requirements.txt
    ```
  - Verify installation: `pip list | findstr websockets`

- **Models not showing in dropdown / Can't load models?**
  - Your models are likely in a custom location (not default C: drive)
  - Set environment variable: `setx OLLAMA_MODELS "D:\ollama\models"` (use your path)
  - Restart terminal and run `START.bat` again
  - See "Configuration (Optional)" section above for details

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
- **websocket_bridge.py**: Python WebSocket bridge server for Ollama integration
- **test-interface.html**: Testing tool for sending manual messages to the Matrix rain
- **START.bat**: Windows launcher script (kills old processes, starts servers, opens browser)
- **requirements.txt**: Python dependencies (websockets, aiohttp)
- **README.md**: This documentation
- **LICENSE**: MIT License


Watch the audio reactive mode in action:
- Movie dialogue: Each character speaks in their own color!
- Music: Bass drums pulse the speed, melodies paint the rainbow
- Syllables trigger instant flow reversals with every word

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
