const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({window: {}});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'rain-camera-motion.js'), 'utf8'), context);
const motion = context.window.RainCameraMotion, radians = degrees => degrees * Math.PI / 180;
function visibility(a) {
    const r = motion.rotation(a.yaw, a.pitch, a.roll);
    // Independently project actual unit world steps onto both screen rows.
    const x = [r[0], r[3]], y = [r[1], r[4]];
    return {x: Math.hypot(...x), y: Math.hypot(...y), area: Math.abs(x[0] * y[1] - x[1] * y[0])};
}
function safe(a) {
    const v = visibility(a);
    assert.ok(v.x >= .65 - 1e-10, 'World-X steps retain visible separation');
    assert.ok(v.y >= .65 - 1e-10, 'World-Y steps retain visible separation');
    assert.ok(v.area >= .55 - 1e-10, 'The planar field retains area instead of collapsing into one line');
}
let cases = 0;
for (let yaw = -540; yaw <= 540; yaw += 15) for (let pitch = -360; pitch <= 360; pitch += 15) {
    const input = {yaw: radians(yaw), pitch: radians(pitch), roll: radians((yaw * 7 + pitch * 3) % 360)};
    const target = motion.safePlanarAngles(input.yaw, input.pitch, input.roll);
    safe(target);
    assert.equal(target.roll, input.roll, 'Roll is preserved exactly');
    assert.ok(Math.abs(target.yaw - input.yaw) <= Math.PI / 2 + 1e-10, 'Yaw correction uses the nearest equivalent interval');
    assert.ok(Math.abs(target.pitch - input.pitch) <= Math.PI / 2 + 1e-10, 'Pitch correction uses the nearest equivalent interval');
    const v = visibility(input);
    if (v.x >= .65 && v.y >= .65 && v.area >= .55) {
        assert.equal(target.yaw, input.yaw, 'A safe yaw remains exact');
        assert.equal(target.pitch, input.pitch, 'A safe pitch remains exact');
    }
    // Compare against the independent safe square: a nearby coupled solution
    // should never require more motion than this conservative fallback.
    const radius = radians(35);
    const nearest = value => {
        const center = Math.round(value / Math.PI) * Math.PI;
        return center + Math.max(-radius, Math.min(radius, value - center));
    };
    const fallback = {yaw: nearest(input.yaw), pitch: nearest(input.pitch), roll: input.roll};
    safe(fallback);
    const distance = a => (a.yaw - input.yaw) ** 2 + (a.pitch - input.pitch) ** 2;
    assert.ok(distance(target) <= distance(fallback) + 2e-6, 'Correction stays closer than a simple safe orientation clamp');
    cases++;
}

for (const yaw of [-90, 0, 90, 180]) for (const pitch of [-90, 0, 90, 180]) for (const roll of [-270, 0, 79, 450]) {
    safe(motion.safePlanarAngles(radians(yaw), radians(pitch), radians(roll)));
}
// Translation by complete revolutions must not normalize or reverse the chosen
// route. A caller can tween these coordinates directly through ±180 degrees.
const base = {yaw: radians(89), pitch: radians(21), roll: radians(77)};
const target = motion.safePlanarAngles(base.yaw, base.pitch, base.roll);
for (const turns of [-4, -1, 1, 4]) {
    const shifted = motion.safePlanarAngles(base.yaw + turns * 2 * Math.PI, base.pitch - turns * 2 * Math.PI, base.roll);
    assert.ok(Math.abs((shifted.yaw - turns * 2 * Math.PI) - target.yaw) < 1e-10);
    assert.ok(Math.abs((shifted.pitch + turns * 2 * Math.PI) - target.pitch) < 1e-10);
    assert.equal(shifted.roll, base.roll);
}
for (const degrees of [-181, -179, 179, 181, 539]) {
    const input = radians(degrees), a = motion.safePlanarAngles(input, radians(75), radians(-47));
    safe(a);
    assert.equal(a.yaw, input, 'Safe yaw is retained while correcting an edge-on pitch near a wrap');
    assert.equal(a.roll, radians(-47));
}
console.log(`Camera planar alignment passed: ${cases} orientations, edge-on cases, projected area, preserved roll and unwrapped continuity.`);
