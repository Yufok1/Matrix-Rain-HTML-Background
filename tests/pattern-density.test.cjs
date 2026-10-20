const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'matrix-rain-utility-suite.html'), 'utf8');
const motion = html.slice(html.indexOf('        const rainMotion ='), html.indexOf('        function drawMatrixRain()'));
const patterns = ['Classic', 'Rainbow', 'Pentad', 'Chaos', 'Harmonic'];
const functions = patterns.map(pattern => {
    const match = html.match(new RegExp('^        function draw' + pattern + 'Rain\\([^]*?^        \\}', 'm'));
    assert.ok(match, 'Find the actual ' + pattern + ' renderer');
    return match[0];
}).join('\n');

for (const pattern of patterns) for (const direction of ['down', 'up', 'left', 'right']) for (const depth of [false, true]) {
    const label = pattern + ' / ' + direction + ' / ' + (depth ? 'depth' : 'flat');
    const painted = [], selected = [];
    const context = vm.createContext({
        window: {
            drawCount: 10,
            activeColumnsMask: [false, true, false, true, false, false],
            userMessageColumns: new Set([4]),
            ollamaMessageColumns: new Set([3])
        },
        MatrixRainEngine: {rainConfig: {direction, fontSize: 10, primaryColor: '#00ff41'}},
        matrixCanvas: {width: 60, height: 600},
        matrixDrops: Array(6).fill(20),
        matrixCtx: {globalAlpha: 1, fillStyle: '#00ff41', fillText() {}},
        rainCamera: {active: depth, enabled: depth, capture: (...args) => painted.push(args[7])},
        rainCameraGPU: {failed: false, lost: false},
        reverseFlowMultiplier: 1,
        getNextCharacter: (characters, index) => { selected.push(index); return characters[0]; },
        console
    });
    vm.runInContext(motion + '\n' + functions + '\nglobalThis.heads = rainMotion.drops;', context);
    vm.runInContext('for (let i = 0; i < 6; i++) rainPosition(i, 10).depth = 500;', context);
    const before = Array.from(context.heads, head => ({x: head.x, y: head.y, depth: head.depth}));
    context['draw' + pattern + 'Rain']('A', 10, 1);

    // Active head 3 belongs to Ollama; user head 4 is deliberately exempt
    // from the density mask. All other inactive heads must stay untouched.
    assert.deepEqual(painted, [1, 4], label + ': only active rain and user heads paint');
    assert.deepEqual(selected, [1, 4], label + ': inactive heads do not request new glyphs');
    for (const index of [0, 2, 3, 5]) {
        const head = context.heads[index];
        assert.deepEqual({x: head.x, y: head.y, depth: head.depth}, before[index], label + ': head ' + index + ' does not move');
        assert.equal(head.lastStamp, null, label + ': head ' + index + ' has no new stamp');
    }
    for (const index of [1, 4]) {
        const head = context.heads[index];
        assert.ok(head.lastStamp, label + ': visible head stamps');
        assert.ok(head.x !== before[index].x || head.y !== before[index].y, label + ': visible head advances');
    }
}

console.log('Pattern density passed: all five renderers honor inactive heads across four headings in flat and depth views.');
