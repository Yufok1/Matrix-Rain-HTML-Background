# Settings coverage audit — revision 9

The UI keeps the accepted choreography and immutable, cohesive birth colors. Original/Refined and Original/Cohesive comparisons, their numeric shortcuts, the preview badge, Hard Refresh, redundant Original View and redundant primary-color swatches are removed. Camera alone controls flat versus 3D. The settings logo reuses the Android vector paths.

| Category | Controls | Saved fields |
| --- | --- | --- |
| Rain | Pattern, speed, intensity, density, character size | `rain.pattern`, `speed`, `intensity`, `density`, `fontSize` |
| Rain | Primary/secondary colors, character set, custom characters, direction, reverse | `rain.primary`, `secondary`, `characterSet`, `customCharacters`, `direction`, `reverse` |
| Audio response | Palette, Beat turns, fluctuation, hue range, saturation and brightness response | `audio.preset`, `beatTurns`, `fluctuation`, `hueReact`, `saturationGain`, `brightnessDepth` |
| Audio response | Preset-derived bounds, retained without standalone sliders | `audio.spread`, `trebleHueRange`, `saturationFloor`, `brightnessMin`, `brightnessMax` |
| Camera | Enabled, mode, current orientation | `camera.enabled`, `mode`, `yaw`, `pitch`, `roll` |
| Camera | Individual motion speeds, including inactive modes | `camera.speeds.showcase`, `corkscrew`, `gyroscope` |
| Rendering | Quality, sharp letters, smooth motion, glow and contrast | `render.quality`, `sharp`, `smooth`, `glow`, `contrast` |
| 3D trails | Variable lengths, stepped fade, shortest/longest tails | `trails.enabled`, `stepped`, `minimum`, `maximum` |
| Configurations | Optional name and schema version | `name`, `v` |

Size minus/plus buttons change the same `rain.fontSize` field as the slider. Imports restore a palette first, then exact saved tuning and private bounds. All three camera speeds are stored, not just the active slider. Custom Unicode characters and inactive manual settings remain represented. The audit also corrected the initial speed slider: it now matches the actual delay through `101 − delay`, so an immediate startup export/import preserves playback speed.

`MR3.` codes drop the two development-mode fields. `MR1.` and `MR2.` are fully validated before migration; their visual preferences are retained, Camera is authoritative, and removed comparison choices become the accepted controller. Unsupported keys, versions, types, ranges and contradictory camera/direction values are rejected before mutation. No code is executed from a blob.

**Session actions deliberately excluded:** Start/Stop audio response, header Stop/Resume, header Reset and Start/Stop auto scenes. Imports do not request permissions, start listening, resume paused playback, or activate timers. Stop preserves the current settings and sharing session, suspending drawing, timers and audio analysis; Resume restores them. Reset releases audio and restores the validated defaults. Shuffle is a one-time action; its resulting visual settings are exportable. Panel placement and category expansion are local presentation and are not copied to a different screen. The sharing panel states these exclusions.

**Overlap and applicability:** Manual appearance is disabled while audio drives those values. Density, character size and reverse remain available. Audio tuning disables until audio starts; unsupported mobile browsers retain the availability message. 3D trail/render controls retain their settings but disable in flat view. Camera speed disables in Fixed mode; pose disables with Camera off. Selecting a motion mode enables Camera through the same setter. Header Stop/Resume replaces the body Pause action; Reset is independent. Both controls leave the settings opener available.

Validation covers every schema leaf, persistent DOM control, UI round trips across all groups, legacy migration, rejected-import atomicity, live-audio retention, inactive camera speeds, Unicode, mobile/desktop bounds, keyboard navigation and text-field hotkeys. Renderer and audio analysis are unchanged; the comparison facade now uses the accepted controller alone.

**Configuration input:** Paste code reads the clipboard only on a click and stages a fully validated code. Import is a separate action. Invalid, denied and late reads do not overwrite an existing code or change settings. Wallpaper Engine's `configurationcode` text user property provides an alternative in the Installed tab; startup and live property events stage the code without importing it. Existing property callbacks are retained. These are input methods, not additional visual fields; MR3 coverage remains 41 leaves.
