const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const Clock = vm.runInNewContext(read('rain-animation-clock.js') + ';RainAnimationClock;');

function simulate(refreshRate) {
    let steps = 0, paints = 0, delay = 35, id = 0, callback;
    const clock = new Clock({
        step: () => steps++, render: (_, phase) => {
            assert.ok(phase >= 0 && phase < 1); paints++;
        }, getDelay: () => delay,
        request: fn => {callback = fn; return ++id;},
        cancel: () => {callback = null;}
    });
    clock.start();
    for (let frame = 0; frame <= refreshRate * 10; frame++) callback(frame * 1000 / refreshRate);
    const ordinarySteps = steps;
    delay = 10;
    for (let frame = refreshRate * 10 + 1; frame <= refreshRate * 11; frame++) callback(frame * 1000 / refreshRate);
    assert.ok(steps - ordinarySteps >= 99 && steps - ordinarySteps <= 104,
        'A live audio speed change reaches simulation without restarting the animation');
    const beforePause = steps;
    callback(60000);
    assert.equal(steps, beforePause + 1, 'Returning from a pause drops the old backlog');
    clock.stop();
    assert.equal(callback, null); assert.equal(clock.running, false);
    return {steps: ordinarySteps, paints};
}
const sixty = simulate(60), oneTwenty = simulate(120);
assert.equal(sixty.steps, 286);
assert.equal(oneTwenty.steps, sixty.steps, 'A faster display cannot speed up the rain');
assert.ok(oneTwenty.paints > sixty.paints, 'Presentation follows the display independently');

let paints = 0;
const cameraContext = vm.createContext({
    window: {matrixRainRendering: {quality: 'low'}, matrixRainTrails: {enabled: true}},
    rainCameraGPU: {render() {paints++;}, hide() {}},
    matrixCanvas: {width: 1320, height: 900}, rainFocalLength: 500, performance
});
vm.runInContext(read('rain-camera-motion.js'), cameraContext);
const camera = vm.runInContext(read('rain-camera.js').split("window.addEventListener('DOMContentLoaded'")[0]
    + ';rainCamera;', cameraContext);
for (let time = 0; time <= 1000; time += 1000 / 120) camera.present(time, 0);
assert.ok(paints >= 24 && paints <= 31, 'Low power caps 3D presentation near 30 FPS');

const atlas = JSON.parse(read('assets/rain-font-msdf.json'));
const metadataContext = {window: {}};
vm.runInNewContext(read('assets/rain-font-msdf.js'), metadataContext);
assert.equal(JSON.stringify(metadataContext.window.RainMSDF), JSON.stringify(atlas),
    'Script-loaded and JSON atlas metadata must agree');
const covered = new Set(atlas.variants.flatMap(variant => variant.glyphs.map(glyph => glyph.unicode)));
for (const [start, end] of [[0x21, 0x7e], [0xff61, 0xff9f]]) {
    for (let code = start; code <= end; code++) assert.ok(covered.has(code), 'Preset font coverage: ' + code.toString(16));
}
const png = fs.readFileSync(path.join(root, 'assets/rain-font-msdf.png'));
assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
assert.equal(png.readUInt32BE(16), atlas.atlas.width);
assert.equal(png.readUInt32BE(20), atlas.atlas.height);
for (const license of ['JetBrainsMono-OFL.txt', 'Noto-OFL.txt', 'Rezmason-MIT.txt']) {
    assert.ok(read('assets/' + license).length > 500, 'Bundled third-party notice: ' + license);
}
console.log('Independent animation timing, live speed, pause recovery, low-power cap and local font coverage passed.');
