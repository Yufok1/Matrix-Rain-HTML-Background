const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'matrix-rain-utility-suite.html'), 'utf8');
function source(name) {
    const matches = html.match(new RegExp('^        function ' + name + '\\([^\\n]*\\) \\{[\\s\\S]*?^        \\}', 'gm'));
    assert.ok(matches?.length, name + ' exists in the application');
    return matches.at(-1);
}
const start = html.indexOf('        const oppositeRainDirections =');
const end = html.indexOf('        function reactToAudio(', start);
let clock = 1000, timerId = 0;
const timers = new Map(), elements = new Map();
const context = vm.createContext({
    performance: {now: () => clock},
    Math: Object.assign(Object.create(Math), {random() {throw Error('Audio steering must not pick random headings');}}),
    Float32Array, console: {log() {}},
    setTimeout(fn, delay) {const id = ++timerId; timers.set(id, {fn, delay}); return id;},
    clearTimeout(id) {timers.delete(id);},
    document: {getElementById(id) {
        if (!elements.has(id)) elements.set(id, {value:'', textContent:'', style:{}});
        return elements.get(id);
    }},
    MatrixRainEngine: {rainConfig: {direction:'down', speed:35}, logActivity() {}},
    drawMatrixRain() {context.frames++;}, frames:0
});
vm.runInContext('let audioReverseEnabled=false, reverseFlowMultiplier=1, matrixInterval=null;\n' +
    html.slice(start, end) + '\n' + ['readWallpaperSpectrum','startMatrixAnimation','toggleReverseFlow'].map(source).join('\n') +
    '\nglobalThis.control={state:audioDirectionState, choose:chooseAudioDirection, reset:resetAudioMotion, spectrum:readWallpaperSpectrum, start:startMatrixAnimation, manual:toggleReverseFlow, ' +
    'configure(enabled, reverse=1){audioReverseEnabled=enabled;reverseFlowMultiplier=reverse;},reverse(){return reverseFlowMultiplier;}};', context);
const control = context.control;
const opposite = {down:'up', up:'down', left:'right', right:'left', toward:'away', away:'toward'};
const axes = Object.keys(opposite);
function step(levels, current, depth=true, elapsed=33) {
    clock += elapsed;
    const next = control.choose(...levels, depth, current, clock);
    assert.notEqual(next, opposite[current], 'Audio must not retrace the immediately preceding segment');
    assert.equal(control.reverse(), 1, 'Audio cannot secretly flip physical movement');
    if (!depth) assert.ok(!['toward','away'].includes(next), 'Disabled depth always uses planar headings');
    return next;
}
function hold(levels, current, ms, depth=true) {
    for (let t=0; t<ms; t+=33) current=step(levels,current,depth);
    return current;
}
for (const enabled of [false,true]) for (const levels of [[60,160,30],[180,20,10],[20,40,180],[90,90,90]]) {
    control.configure(enabled);control.reset();
    let current=hold(levels,'down',3000);
    const heading=current;
    for (let frame=0;frame<900;frame++) {
        current=step(levels.map((v,i)=>v+Math.sin(frame*.21+i)*1.5),current);
        assert.equal(current,heading,'A held sound does not produce regular right turns');
    }
    assert.equal(step([0,0,0],current,true,90000),heading,'Silence holds any heading indefinitely');
}
// Frequency attacks and releases steer the rain without a timed direction cycle.
const reached = new Set();
let changes=0;
for (const depth of [false,true]) for (const enabled of [false,true]) for (const initial of axes) {
    control.configure(enabled);control.reset();
    let current=initial;
    for (let frame=0;frame<2400;frame++) {
        const segment=Math.floor(frame/47)%6;
        const level=[30,80,190,60,140,15][Math.floor(frame/13)%6];
        const bands=[15,15,15];bands[segment%3]=level;
        const next=step(bands,current,depth);
        if(next!==current){changes++;reached.add(next);}
        current=next;
    }
}
for (const direction of axes) assert.ok(reached.has(direction),'Changing audio can select '+direction);
assert.ok(changes>50,'The reversal guard must not freeze meaningful audio responses');
// Different frequency content matters even at identical overall volume.
control.configure(false);control.reset();
let current=hold([180,20,20],'down',3000);
const bassHeading=current;
current=hold([20,20,180],current,300);
assert.notEqual(current,bassHeading,'Treble can answer bass at the same total loudness');
// Stereo order must not masquerade as frequency content or wrap loud samples.
let previous=-1;
for(let level=0;level<=1;level+=.005) {
    const value=control.spectrum(Array(128).fill(level))[0];
    assert.ok(value>=previous && value>=0 && value<=255,'Louder WE samples remain louder and bounded');
    previous=value;
}
const stereo=Array(128).fill(0);stereo[0]=.2;stereo[127]=.3;
const mono=control.spectrum(stereo);
assert.ok(mono[0]>0 && mono[63]>0 && mono[32]===0);
const swapped=stereo.slice(64).concat(stereo.slice(0,64));
assert.deepEqual(control.spectrum(swapped),mono,'Channel swapping preserves frequency analysis');
for(const value of control.spectrum(Array(128).fill(100))) assert.ok(Number.isFinite(value) && value<=255);
// Audio speed changes must reach the real animation without restarting it.
control.start();assert.equal(timers.size,1);
let [id,timer]=timers.entries().next().value;assert.equal(timer.delay,35);
context.MatrixRainEngine.rainConfig.speed=18;timers.delete(id);timer.fn();
assert.equal(context.frames,1);assert.equal(timers.size,1);
[id,timer]=timers.entries().next().value;assert.equal(timer.delay,18,'Bass acceleration changes the actual next frame');
context.MatrixRainEngine.rainConfig.speed=80;timers.delete(id);timer.fn();
assert.equal(timers.values().next().value.delay,80,'Easing audio slows the real streams');
control.start();assert.equal(timers.size,1,'Starting again never duplicates the render loop');
control.manual();assert.equal(control.reverse(),-1,'Explicit manual reverse remains available');
control.manual();assert.equal(control.reverse(),1);
assert.doesNotMatch(html.slice(start,end),/Math\.random/);
assert.doesNotMatch(html,/detectSyllables|turnAudioAtBeat|detectBeats/,'No competing clock-triggered direction controller');
assert.doesNotMatch(html,/<(select|option)\b/i,'Keep CEF-safe settings');
console.log('Held/noisy sound, six audio headings, 57,600 mixed frames, stereo isolation, monotonic gain, no U-turns and adaptive animation timing passed.');
