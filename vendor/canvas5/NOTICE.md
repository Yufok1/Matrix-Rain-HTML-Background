# Canvas-5 adaptations

Created by Jeff Towers (Tostido / Yufok1), copyright 2026.

`words.js` extracts the speech-window and recognition-result helpers from Canvas-5's `media-workflow.js`. `rain-media-words.js` adapts the local browser speech lifecycle from `capture-studio.js`. `rain-tab-sync.js` adapts its bounded frame buffer and shared-tab audio routing. The adaptations omit microphone, recording, Android, and remote-service routes.

These files retain the Canvas-5 PolyForm Noncommercial 1.0.0 license in [LICENSE.txt](LICENSE.txt). Commercial use requires a separate written license from the creator. Other Matrix Rain Omni source retains its existing license.
