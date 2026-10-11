const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'matrix-rain-utility-suite.html'), 'utf8');
function functions(name) {
    const pattern = new RegExp('^        function ' + name + '\\([^\\n]*\\) \\{[\\s\\S]*?^        \\}', 'gm');
    const matches = html.match(pattern);
    assert.ok(matches?.length, 'Actual release function must exist: ' + name);
    return matches.at(-1);
}
const start = html.indexOf('        const oppositeRainDirections =');
const end = html.indexOf('        function reactToAudio(', start);
let clock = 1000;
let random = 0;
const elements = new Map();
const context = vm.createContext({
    performance: {now: () => clock},
    Date: {now: () => 1700000000000 + clock},
    Math: Object.assign(Object.create(Math), {random: () => random}),
    document: {getElementById: id => {
        if (!elements.has(id)) elements.set(id, {value: '', textContent: '', style: {}});
        return elements.get(id);
    }},
    MatrixRainEngine: {rainConfig: {direction: 'down'}, logActivity() {}}
});
vm.runInContext('let reverseFlowMultiplier = 1; let audioReverseEnabled = false; let audioDiagonalsEnabled = true; let lastSyllableOrBeatReversalTime = 0;\n' +
    html.slice(start, end) + '\n' + functions('onSyllableDetected') + '\n' + functions('onBeatDetected') + '\n' + functions('toggleReverseFlow') + '\n' +
    'globalThis.control = {state:audioDirectionState, choose:chooseAudioDirection, syllable:onSyllableDetected, beat:onBeatDetected, manual:toggleReverseFlow, ' +
    'configure(depth, enabled, reverse) {audioDiagonalsEnabled=depth;audioReverseEnabled=enabled;reverseFlowMultiplier=reverse;}, reverse() {return reverseFlowMultiplier;}};', context);
const control = context.control;
const opposite = {down:'up', up:'down', left:'right', right:'left', toward:'away', away:'toward'};
const axes = Object.keys(opposite);

// Sweep all supplied audio levels, including the boundaries, starting on each
// heading. Every former U-turn must now hold its heading, while other axes work.
for (const depth of [false, true]) for (const current of axes) {
    const reached = new Set();
    for (let level = 0; level <= 255; level++) {
        Object.assign(control.state, {peak:200, sampledAt:clock, changedAt:-Infinity});
        const next = control.choose(level, level, level, depth, current, clock);
        assert.notEqual(next, opposite[current], current + ' must not immediately reverse');
        reached.add(next);
    }
    for (const direction of (depth ? axes : axes.slice(0, 4))) {
        if (direction !== opposite[current]) assert.ok(reached.has(direction), current + ' can still turn ' + direction);
    }
    clock += 1000;
}

// Existing pause behavior survives: no arbitrary turn after a long silent gap.
for (const current of axes) {
    Object.assign(control.state, {peak:200, sampledAt:clock, changedAt:clock});
    assert.equal(control.choose(0, 0, 0, true, current, clock + 90000), current);
}

// Beat/syllable mode cannot bypass the guard by flipping the movement multiplier.
for (const depth of [false, true]) for (const reverse of [-1, 1]) for (const current of axes) {
    for (const randomEdge of [0, .999999]) {
        clock += 1000; random = randomEdge;
        context.MatrixRainEngine.rainConfig.direction = current;
        control.configure(depth, false, reverse);
        control.state.changedAt = -Infinity;
        control.syllable();
        assert.equal(context.MatrixRainEngine.rainConfig.direction, current, 'Disabled beat turns do nothing');
        control.configure(depth, true, reverse);
        control.syllable();
        const next = context.MatrixRainEngine.rainConfig.direction;
        assert.notEqual(next, current, 'A beat makes a visible turn');
        assert.notEqual(next, opposite[current], 'A beat never retraces its last segment');
        assert.equal(control.reverse(), reverse, 'Audio cannot flip the physical movement sign');
        assert.equal(elements.get('rainDirection').value, next, 'Direction UI follows the turn');
        clock += 20;
        control.syllable();
        assert.equal(context.MatrixRainEngine.rainConfig.direction, next, 'Rapid syllables honor the shared segment duration');
        clock += 700;
        control.beat(255);
        assert.notEqual(context.MatrixRainEngine.rainConfig.direction, opposite[next], 'Backup bass beats also obey the guard');
        assert.equal(control.reverse(), reverse);
    }
}

// Simulate rapid volume swings and syllables together using the actual handlers.
for (const reverse of [-1, 1]) {
    let current = 'down';
    control.configure(true, true, reverse);
    Object.assign(control.state, {peak:100, sampledAt:clock, changedAt:-Infinity});
    context.MatrixRainEngine.rainConfig.direction = current;
    for (let frame = 0; frame < 1800; frame++) {
        clock += 33; random = (frame % 100) / 100;
        if (frame % 3 === 0) control.syllable();
        const level = [0, 24, 45, 70, 100, 35, 90, 10][frame % 8];
        context.MatrixRainEngine.rainConfig.direction = control.choose(level, level, level, true, context.MatrixRainEngine.rainConfig.direction, clock);
        const next = context.MatrixRainEngine.rainConfig.direction;
        assert.notEqual(next, opposite[current], 'Combined audio paths cannot reverse within the same rendered frame');
        assert.equal(control.reverse(), reverse);
        current = next;
    }
}

control.configure(true, false, 1);
control.manual(); assert.equal(control.reverse(), -1, 'Explicit manual reversal still works');
control.manual(); assert.equal(control.reverse(), 1);
assert.doesNotMatch(html, /matrixSpeech|speech\/rain-speech|data-speech-test/);
assert.doesNotMatch(html, /<(select|option)\b/i, 'Keep the CEF-safe settings controls');
console.log('All six headings reject immediate audio U-turns; beat turns, cooldown, silence hold, manual reverse, and 3,600 mixed audio frames passed.');
