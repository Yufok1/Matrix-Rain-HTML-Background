// Calibrated animated view paths and orthonormal yaw/pitch/roll rows.
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
    // Radians, matching rotation(). Keep roll and unwrapped coordinates so a
    // caller can interpolate this small correction without crossing a seam.
    function safePlanarAngles(yaw, pitch, roll = 0, minimumStep = .65, minimumArea = .55) {
        const r = rotation(yaw, pitch, roll);
        if (Math.hypot(r[0], r[3]) >= minimumStep && Math.hypot(r[1], r[4]) >= minimumStep
            && Math.abs(r[8]) >= minimumArea) return {yaw, pitch, roll};
        // Roll rotates the image but cannot change either projected axis length
        // or their determinant. Equivalent safe intervals repeat every pi.
        const reduced = angle => angle - Math.round(angle / Math.PI) * Math.PI;
        const py = reduced(yaw), pp = reduced(pitch), ay = Math.abs(py), ap = Math.abs(pp);
        const step = Math.min(1, minimumStep + 1e-8), area = Math.min(1, minimumArea + 1e-8);
        const maximumPitch = Math.acos(Math.max(step, area)), zLimit = Math.sqrt(1 - step * step);
        const yawLimit = p => {
            const cp = Math.cos(p);
            return Math.min(Math.asin(Math.min(1, zLimit / cp)), Math.acos(Math.min(1, area / cp)));
        };
        const cost = p => (p - ap) ** 2 + Math.max(0, ay - yawLimit(p)) ** 2;
        let best = Math.min(ap, maximumPitch), score = cost(best);
        const consider = p => {const next = cost(p); if (next < score) {best = p; score = next;}};
        // A small one-dimensional search handles the coupled yaw/pitch bounds.
        // This runs once when planning a flat view, never during each repaint.
        const spacing = maximumPitch / 48;
        for (let i = 0; i <= 48; i++) consider(i * spacing);
        let low = Math.max(0, best - spacing), high = Math.min(maximumPitch, best + spacing);
        for (let i = 0; i < 24; i++) {
            const a = (2 * low + high) / 3, b = (low + 2 * high) / 3;
            if (cost(a) < cost(b)) high = b; else low = a;
        }
        consider((low + high) / 2);
        return {yaw: yaw + (Math.sign(py) || 1) * (Math.min(ay, yawLimit(best)) - ay),
            pitch: pitch + (Math.sign(pp) || 1) * (best - ap), roll};
    }
    root.RainCameraMotion = {modes, angles, rotation, safePlanarAngles};
})(typeof window === 'undefined' ? globalThis : window);
