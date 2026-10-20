const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('matrix-rain-utility-suite.html');
const vectors = {down: [0, 1, 0], up: [0, -1, 0], right: [1, 0, 0], left: [-1, 0, 0], toward: [0, 0, -1], away: [0, 0, 1]};
function setup(flat, audio, reverse, direction) {
    const context = vm.createContext({window: {columnOrder: Array.from({length: 80}, (_, i) => i), audioReactiveActive: audio},
        MatrixRainEngine: {rainConfig: {direction, fontSize: 10, density: 100, speed: 37}}, audioReverseEnabled: true,
        matrixCanvas: {width: 800, height: 600}, matrixDrops: Array(80).fill(20),
        matrixCtx: {globalAlpha: 1, fillStyle: '#123456', fillText() {}},
        rainCameraGPU: {failed: false, lost: false, invalidate: false}, reverseFlowMultiplier: reverse, performance, console});
    vm.runInContext(read('rain-all-directions.js'), context);
    vm.runInContext(html.slice(html.indexOf('        const rainMotion ='), html.indexOf('        function drawMatrixRain()')), context);
    vm.runInContext([...html.matchAll(/^        function recomputeActiveColumnsMask\(\) \{[\s\S]*?^        \}/gm)].at(-1)[0], context);
    vm.runInContext(read('rain-camera.js').split("window.addEventListener('DOMContentLoaded'")[0], context);
    vm.runInContext(`globalThis.camera = rainCamera; globalThis.motion = rainMotion;
        globalThis.tick = () => {prepareRainMotion(10); for (let i = 0; i < 32; i++) {
            const p = rainPosition(i, 10); paintRainCharacter('カ', p.x, p.y, i, 10); advanceRainPosition(i, 10, 1.3);
        } rainCamera.frame++;};
        for (let i = 0; i < 80; i++) {const p = rainPosition(i, 10); p.depth = 500; p.x = 100 + i % 16 * 40; p.y = 200 + i % 3 * 30;}
    `, context);
    context.camera.enabled = !flat; context.camera.continuous = true; context.camera.perspective = flat ? 0 : 1;
    context.recomputeActiveColumnsMask();
    return context;
}
const birth = mark => [mark.x, mark.y, mark.z, mark.fontSize, mark.char, mark.color];

let handoffs = 0;
for (const flat of [false, true]) for (const audio of [false, true]) for (const reverse of [1, -1]) {
    const headings = flat ? ['down', 'up', 'left', 'right'] : Object.keys(vectors);
    for (const heading of headings) {
        const context = setup(flat, audio, reverse, heading), flow = context.window.rainAllDirections;
        const axis = vectors[heading].findIndex(value => value !== 0);
        for (let frame = 0; frame < 4; frame++) context.tick();
        const history = context.camera.marks.map(birth);
        for (const mode of ['counterflow', 'directed']) {
            const before = JSON.stringify(context.motion.drops);
            flow.applyMode(mode, true);
            assert.equal(JSON.stringify(context.motion.drops), before, 'A formation request does not warp or reseed any native head');
            for (let frame = 0; frame < 24; frame++) {
                const previousCount = context.camera.marks.length;
                context.tick();
                for (const mark of context.camera.marks.slice(previousCount)) {
                    for (let coordinate = 0; coordinate < 3; coordinate++) if (coordinate !== axis) {
                        assert.ok(Math.abs(mark.delta[coordinate]) < 1e-6, `${heading}/${mode}: no sideways native segment, including forks`);
                    }
                    assert.ok(Math.hypot(...mark.delta) <= 13.00001, 'Formation changes never accelerate native glyph steps');
                }
                for (const head of context.motion.drops.slice(0, 32)) {
                    assert.equal(vectors[head.lastStepDirection].findIndex(value => value !== 0), axis, 'Every visible native head stays on the original flow axis');
                }
                assert.equal(context.MatrixRainEngine.rainConfig.speed, 37, 'The simulation pace remains unchanged');
            }
            assert.equal(flow.transitioning, false, 'The real staggered handoff settles');
            for (let index = 0; index < 32; index++) {
                assert.equal(context.motion.drops[index].lastStepDirection, flow.directionFor(index, !flat) || heading, 'Every lane reaches its assigned heading');
                assert.equal(flow.records.get(index).formationReverse, undefined, 'Direct-reversal permission expires with the formation handoff');
            }
            assert.deepEqual(context.camera.marks.slice(0, history.length).map(birth), history, 'Existing positions, glyph sizes, characters and colors stay immutable');
            handoffs++;
        }
    }
}

// A continuous flat projection still uses the shared world renderer. Its future
// stream headings must nevertheless stay planar, with or without live audio.
for (const audio of [false, true]) for (const flat of [false, true]) {
    const context = setup(flat, audio, 1, 'down'), flow = context.window.rainAllDirections;
    context.tick();
    const history = context.camera.marks.map(birth);
    flow.applyMode('crossflow');
    for (let frame = 0; frame < 12; frame++) context.tick();
    const headings = new Set(context.motion.drops.slice(0, 32).map(head => head.lastStepDirection));
    assert.equal(headings.size, flat ? 4 : 6, 'Actual Crossflow heads use the projection-appropriate axis count');
    if (flat) assert.ok(!headings.has('toward') && !headings.has('away'), 'Continuous flat Crossflow never introduces a Z heading');
    assert.equal(context.camera.active, true, 'The shared renderer stays active at the flat endpoint');
    assert.deepEqual(context.camera.marks.slice(0, history.length).map(birth), history, 'Axis selection leaves existing world history untouched');
}
console.log(`Formation handoffs passed: ${handoffs} real Single/Counterflow swaps without sideways steps; continuous flat Crossflow stays planar with and without audio.`);
