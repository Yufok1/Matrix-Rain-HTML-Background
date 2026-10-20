const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('matrix-rain-utility-suite.html');
function source(name) {
    const matches = html.match(new RegExp('^        function ' + name + '\\([^\\n]*\\) \\{[\\s\\S]*?^        \\}', 'gm'));
    assert.ok(matches?.length, name);
    return matches.at(-1);
}
function fixture(width, audio = false, oldFont = 32) {
    let seed = 10291;
    const elements = new Map(), writes = [];
    const element = id => {
        if (!elements.has(id)) elements.set(id, {value: '', style: {}, dataset: {}, textContent: '', classList: {add() {}, remove() {}}});
        return elements.get(id);
    };
    const context = vm.createContext({
        window: {addEventListener() {}, audioReactiveActive: audio, matrixRainRendering: {quality: 'balanced', sharp: true, smooth: true, glow: .15, contrast: 1}},
        document: {getElementById: element, querySelector: () => element('pattern'), querySelectorAll: () => []},
        localStorage: {getItem: () => null, setItem: (...args) => writes.push(args), removeItem() {}},
        Math: Object.assign(Object.create(Math), {random() {seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296;}}),
        MatrixRainEngine: {rainConfig: {direction: 'down', fontSize: 100, density: 100, speed: 1, intensity: 72,
            pattern: 'classic', characterSet: 'katakana', primaryColor: '#00ff41', secondaryColor: '#00cc33'}},
        matrixCanvas: {width, height: 1080, style: {}}, matrixDrops: Array(Math.floor(width / 10)).fill(20),
        matrixCtx: {globalAlpha: 1, fillStyle: '#123456', save() {}, restore() {}, clearRect() {}, fillText() {}},
        rainCameraGPU: {invalidate: false, failed: false, lost: false, hide() {}},
        autoOrchestratorActive: true, reverseFlowMultiplier: 1, getNextCharacter: () => 'A', console
    });
    vm.runInContext(read('rain-camera-motion.js'), context);
    vm.runInContext(read('rain-camera.js').split("window.addEventListener('DOMContentLoaded'")[0], context);
    vm.runInContext(html.slice(html.indexOf('        const rainMotion ='), html.indexOf('        function drawMatrixRain()')), context);
    vm.runInContext(source('recomputeActiveColumnsMask') + '\n' + source('drawClassicRain'), context);
    vm.runInContext(read('trails/rain-trail-lengths.js').replace('export class', 'class') + '\nwindow.matrixRainTrails = new RainTrailLengths();', context);
    vm.runInContext(read('rain-all-directions.js'), context);
    vm.runInContext(read('rain-auto-scenes.js'), context);
    vm.runInContext('globalThis.camera = rainCamera; globalThis.motion = rainMotion;', context);
    const camera = context.camera, flow = context.window.rainAllDirections;
    const scenes = context.window.rainAutoScenes, config = context.MatrixRainEngine.rainConfig, trails = context.window.matrixRainTrails;
    trails.enabled = true; trails.configure(100, 160);
    camera.continuous = true; camera.perspective = 0;
    if (oldFont) {
        camera.capture('カ', 100, 200, 500, oldFont, .75, '#123456', 0);
        camera.advanceFrame();
    }
    context.recomputeActiveColumnsMask();
    return {context, camera, flow, scenes, config, trails, writes};
}
const birthState = mark => JSON.stringify([mark.x, mark.y, mark.z, mark.fontSize, mark.color, mark.char, mark.rgb, mark.delta]);
function bounded(h, label) {
    const budget = h.scenes.loadBudget();
    assert.ok(budget.work <= budget.maximum, label + ': combined work stays within the live budget');
    assert.ok(h.config.density <= budget.density, label + ': density obeys current load capacity');
    assert.ok(h.config.fontSize <= 20, label + ': new glyph size is bounded');
    if (h.trails.enabled) {
        assert.ok(h.trails.minimum >= 24 && h.trails.minimum <= 40, label + ': shortest tail stays bounded');
        assert.ok(h.trails.maximum >= h.trails.minimum && h.trails.maximum <= 64, label + ': longest tail stays bounded');
    }
    const mask = h.context.window.activeColumnsMask;
    assert.equal(mask.length, Math.floor(h.context.matrixCanvas.width / 10), label + ': actual source population follows viewport width');
    assert.ok(mask.some(Boolean), label + ': useful rain remains active');
    if (!h.context.window.audioReactiveActive) assert.ok(h.config.speed >= 30, label + ': Auto simulation delay is bounded');
}

// Exercise the real cap over every projection increment, several monitor widths,
// uniform/variable trails, and both audio ownership states. The retained glyph
// is measured by the actual camera bounds pass, rather than a fabricated pad.
for (const width of [800, 1920, 3840, 7680]) for (const audio of [false, true]) for (const variable of [false, true]) {
    const h = fixture(width, audio), old = birthState(h.camera.marks[0]);
    h.trails.enabled = variable;
    for (const flow of ['directed', 'counterflow', 'crossflow']) {
        h.flow.applyMode(flow);
        for (let frame = 0; frame <= 100; frame++) {
            const perspective = frame / 100;
            h.camera.perspective = perspective;
            h.camera.enabled = perspective !== 0;
            h.config.density = 100;
            h.scenes.advance(1 / 60);
            bounded(h, `${width}/${audio}/${variable}/${flow}/${perspective}`);
            assert.equal(birthState(h.camera.marks[0]), old, 'Budgeting preserves the exact retained glyph birth');
            if (audio) assert.equal(h.config.speed, 1, 'Budgeting leaves audio speed untouched');
        }
    }
    h.camera.syncTrailSettings();
    assert.ok(h.camera.marks[0].trailLength <= (variable ? 64 : 40), 'Actual retained lifetimes follow capped trail settings');
    const active = h.context.window.activeColumnsMask.filter(Boolean).length;
    const before = h.camera.marks.length;
    h.context.drawClassicRain('A', h.config.fontSize, 1);
    assert.equal(h.camera.marks.length - before, active, 'Actual renderer births exactly the independently counted active population');
    assert.ok(h.camera.marks.slice(before).every(mark => mark.fontSize <= 20), 'Actual new births honor the font cap');
    assert.equal(birthState(h.camera.marks[0]), old, 'Rendering after the cap preserves old positions, size and color');
    assert.deepEqual(h.writes, [], 'Auto does not persist its limits over manual preferences');
}

// Opening and closing use actual camera interpolation alongside density, font
// and tail tweens, checking intermediate frames rather than only destinations.
for (const width of [800, 3840, 7680]) for (const audio of [false, true]) {
    const h = fixture(width, audio, 40), old = birthState(h.camera.marks[0]);
    h.scenes.advance(0);
    for (const enabled of [true, false]) {
        h.flow.applyMode('directed');
        assert.equal(h.scenes.apply({kind: 'depth', value: enabled}), true);
        h.scenes.apply({kind: 'size'});
        h.scenes.apply({kind: 'tails', value: 'vary'});
        const seen = new Set();
        for (let frame = 0; frame <= 250; frame++) {
            h.camera.advanceTransitions(1 / 60);
            h.scenes.advance(1 / 60);
            seen.add(h.camera.perspective);
            bounded(h, `interpolating ${width}/${audio}/${enabled}/${frame}`);
            assert.equal(birthState(h.camera.marks[0]), old);
        }
        assert.ok(seen.size > 200, 'The real depth morph passes through a continuous range');
        assert.equal(h.camera.perspective, Number(enabled), 'The depth transition reaches its endpoint');
    }
}

// Large retained glyphs must tighten new admission even after the current font
// has reached its safe value; releasing those bounds may increase coverage.
for (const width of [800, 1920, 3840, 7680]) {
    const h = fixture(width, false, 32);
    h.camera.perspective = 1; h.scenes.advance(0);
    h.config.density = 100; h.scenes.advance(0);
    const retained = h.config.density;
    h.camera.marks.length = 0; h.camera.advanceFrame();
    h.config.density = 100; h.scenes.advance(0);
    assert.ok(h.config.density > retained, 'Retained large glyphs restrict density until their history expires');
}

// With Auto off and no pending interpolation, the entire manual range remains
// available, including extreme settings that Auto itself no longer generates.
for (const audio of [false, true]) {
    const h = fixture(7680, audio);
    h.context.autoOrchestratorActive = false;
    const before = JSON.stringify([h.config, h.trails, h.camera.marks]);
    h.scenes.advance(10);
    assert.equal(JSON.stringify([h.config, h.trails, h.camera.marks]), before, 'Inactive Auto leaves manual settings and history untouched');
    assert.deepEqual(h.writes, []);
}

// Stopping Auto still lets an existing interpolation finish safely when the
// projection tightens the budget on the exact frame its last tween completes.
{
    const h = fixture(7680);
    h.scenes.apply({kind: 'density'});
    assert.ok(h.scenes.tweens.length, 'A real density interpolation is pending');
    h.context.autoOrchestratorActive = false;
    h.camera.perspective = 1;
    h.scenes.advance(10);
    assert.equal(h.scenes.tweens.length, 0);
    bounded(h, 'last tween completion after Auto stops');
}

// Caps preserve useful spatial variation while audio retains its exact musical
// output. Repeated real targets must continue changing size and density.
{
    const h = fixture(3840, true, 0), sizes = new Set(), densities = new Set();
    h.config.fontSize = 16; h.config.speed = 9;
    h.scenes.advance(0);
    for (let round = 0; round < 20; round++) {
        const musical = JSON.stringify([h.config.speed, h.config.intensity, h.config.direction, h.config.primaryColor, h.config.secondaryColor]);
        for (const kind of ['size', 'density']) {
            assert.equal(h.scenes.next(kind), true, 'Combined Auto keeps accepting requested spatial changes');
            if (kind === 'size') {
                const change = h.scenes.tweens.find(tween => tween.object === h.config && tween.key === 'fontSize');
                assert.ok(change && Math.abs(change.to - change.from) >= 4, 'Combined size targets retain a visible minimum change');
            }
            for (let frame = 0; frame < 251; frame++) {h.scenes.advance(1 / 60); bounded(h, 'combined target');}
        }
        sizes.add(h.config.fontSize); densities.add(h.config.density);
        assert.equal(JSON.stringify([h.config.speed, h.config.intensity, h.config.direction, h.config.primaryColor, h.config.secondaryColor]), musical);
    }
    assert.ok(sizes.size >= 3 && densities.size >= 3, 'Combined Auto continues producing multiple useful size and density destinations');
}
console.log('Auto load budget passed: viewport, retained glyphs, tails, continuous transitions, audio ownership and manual-range guards.');
