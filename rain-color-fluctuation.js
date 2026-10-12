// Amplify actual hue changes, preserving held colors and the initial preset hue.
(function (root) {
    'use strict';
    class RainColorFluctuation {
        constructor() { this.reset(); }
        reset() { this.ready = false; }
        applyHue(hue, percent, preset, hueGain) {
            const gain = Math.max(100, Math.min(500, Number(percent) || 100));
            if (!this.ready || this.preset !== preset || this.hueGain !== hueGain || this.sensitivity !== gain) {
                this.ready = true; this.previous = this.displayed = hue;
                this.preset = preset; this.hueGain = hueGain; this.sensitivity = gain;
            } else {
                const delta = (hue - this.previous + 540) % 360 - 180;
                this.displayed = (this.displayed + delta * gain / 100) % 360;
                if (this.displayed < 0) this.displayed += 360;
                this.previous = hue;
            }
            return Math.round(this.displayed) % 360;
        }
    }
    root.RainColorFluctuation = RainColorFluctuation;
})(typeof window === 'undefined' ? globalThis : window);
