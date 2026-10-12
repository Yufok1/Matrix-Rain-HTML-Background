// The Android renderer's animated view paths and orthonormal yaw/pitch/roll rows.
// This module animates the virtual viewpoint; it never reads a device sensor.
(function (root) {
    'use strict';
    const modes = ['fixed', 'showcase', 'corkscrew', 'gyroscope'];
    function angles(mode, seconds) {
        const t = Math.max(0, Number(seconds) || 0);
        let yaw = 0, pitch = 0, roll = 0;
        if (mode === 'showcase') { yaw = t * .085; pitch = .22 * Math.sin(t * .057); }
        else if (mode === 'corkscrew') { yaw = t * .16; pitch = .38 * Math.sin(t * .14); roll = t * .22; }
        else if (mode === 'gyroscope') {
            yaw = t * .47 + .3 * Math.sin(t * .31);
            pitch = t * .37 + .28 * Math.sin(t * .23); roll = t * .59;
        }
        return {yaw, pitch, roll};
    }
    function rotation(yaw, pitch, roll = 0) {
        const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
        const cr = Math.cos(roll), sr = Math.sin(roll);
        const x = [cy, 0, -sy], y = [-sp * sy, cp, -sp * cy], z = [cp * sy, sp, cp * cy];
        const out = new Array(9);
        for (let i = 0; i < 3; i++) {
            out[i] = cr * x[i] + sr * y[i];
            out[i + 3] = -sr * x[i] + cr * y[i]; out[i + 6] = z[i];
        }
        return out;
    }
    root.RainCameraMotion = {modes, angles, rotation};
})(typeof window === 'undefined' ? globalThis : window);
