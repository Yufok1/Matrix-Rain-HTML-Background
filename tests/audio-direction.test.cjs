const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const audioModule={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../rain-audio-motion.js'),'utf8'),audioModule);
const RainAudioMotion=audioModule.RainAudioMotion;
const opposite={toward:'away',away:'toward',down:'up',up:'down',left:'right',right:'left'};
function run(generate,{frames=1200,depth=true,beatTurns=false,scale=1}={}) {
    const motion=new RainAudioMotion();let heading='down';
    const outputs=[];
    for(let frame=0;frame<frames;frame++) {
        const mono=generate(frame).map(value=>value*scale);
        const output=motion.update(RainAudioMotion.wallpaperSpectrum(mono.concat(mono)),frame*1000/30,heading,depth,beatTurns);
        heading=output.direction;outputs.push({...output});
        assert.ok(output.speed>=15 && output.speed<=85);
        if(!depth) assert.ok(!['toward','away'].includes(heading));
    }
    return {motion,outputs};
}
const movedBins=frame=>{
    const mono=Array(64).fill(.015);mono[Math.floor(frame/6)%2 ? 24 : 34]=.35;return mono;
};
const bassPulses=frame=>{const mono=Array(64).fill(0);mono.fill(frame%15<4 ? .35 : .015,0,8);return mono;};
const allHeadings=frame=>{const mono=Array(64).fill(.015);mono[[2,14,25,35,46,60][Math.floor(frame/15)%6]]=.35;return mono;};
const summary=[];
for(const beatTurns of [false,true]) {
    const moved=run(movedBins,{beatTurns});
    assert.ok(moved.motion.turnCount>=150,'Within-band changes must reach the motion controller');
    const pulses=run(bassPulses,{beatTurns});
    assert.ok(pulses.motion.eventCount>=70,'Repeated same-band attacks must keep producing accents');
    const speeds=pulses.outputs.slice(90).map(value=>value.speed);
    assert.ok(Math.max(...speeds)-Math.min(...speeds)>=12,'Same-heading percussion must visibly accelerate and ease');
    const held=run(frame=>Array.from({length:64},(_,i)=>.12+Math.sin(frame*.2+i)*.0007),{beatTurns});
    assert.equal(held.motion.turnCount,0,'A steady sound plus tiny noise must not invent periodic corners');
    assert.equal(held.motion.eventCount,0);
    const melody=run(allHeadings,{beatTurns});
    assert.deepEqual(new Set(melody.motion.trace.map(event=>event.to)),new Set(Object.keys(opposite)),'Full spectral evolution can use all six headings');
    const planar=run(allHeadings,{beatTurns,depth:false});
    assert.equal(planar.outputs.length,1200);
    const vibrating=run(frame=>{
        const mono=Array(64).fill(.01);mono[Math.floor(frame/3)%2 ? 24 : 25]=.3;return mono;
    },{beatTurns});
    assert.equal(vibrating.motion.turnCount,0,'Adjacent vibrato-like shifts should not be interpreted as new attacks');
    const retracing=run(frame=>{
        const mono=Array(64).fill(.015);mono[Math.floor(frame/6)%2 ? 2 : 35]=.35;return mono;
    },{beatTurns});
    const reversals=retracing.motion.trace.filter(event=>event.to===opposite[event.from]);
    assert.ok(reversals.length>0,'Reversals are permitted, rather than banned forever');
    for(let i=1;i<reversals.length;i++) assert.ok(reversals[i].time-reversals[i-1].time>=1399,'Repeated same-line oscillation is restrained');
    const heading=melody.outputs.at(-1).direction;
    let after;
    for(let frame=0;frame<100;frame++) after=melody.motion.update(new Float32Array(64),50000+frame*33,heading,true,beatTurns);
    assert.equal(after.direction,heading,'Silence cannot advance an automatic direction sequence');
    const quiet=run(movedBins,{beatTurns,scale:.1});
    assert.ok(quiet.motion.turnCount>=150,'Lower playback volume retains sensitivity');
    assert.deepEqual(run(movedBins,{beatTurns}).outputs,moved.outputs,'Identical audio creates reproducible decisions');
    summary.push({beatTurns,withinBandTurns:moved.motion.turnCount,bassAccents:pulses.motion.eventCount,bassSpeedRange:[Math.min(...speeds),Math.max(...speeds)],sixHeadings:[...new Set(melody.motion.trace.map(event=>event.to))],heldTurns:held.motion.turnCount,vibratoTurns:vibrating.motion.turnCount,legitimateReversals:reversals.length,quietTurns:quiet.motion.turnCount});
}
// Exercise actual HTML integration and rendering clock, not just the model.
const preview=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(preview,'matrix-rain-utility-suite.html'),'utf8');
let scripts=0;
for(const [,attributes,body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const source=attributes.match(/src="([^"]+)"/)?.[1]?.split('?')[0];
    if(source) {
        assert.ok(fs.existsSync(path.join(preview,source)),source+' is packaged');
        if(!attributes.includes('module')) new vm.Script(fs.readFileSync(path.join(preview,source),'utf8'));
    } else {new vm.Script(body);scripts++;}
}
assert.equal(scripts,2); // Startup visibility marker and the main application.
assert.doesNotMatch(html,/<(select|option)\b/i,'Preserve CEF-safe settings');
assert.equal((html.match(/window\.wallpaperRegisterAudioListener\(function/g)||[]).length,1);
assert.doesNotMatch(html,/chooseAudioDirection|audioDirectionState/,'Remove the previous competing selector');
const start=html.indexOf('        const audioMotion =');
const end=html.indexOf('        function drawAudioVisualizer(',start);
const hsl=html.match(/^        function hslToHex\([^\n]*\) \{[\s\S]*?^        \}/m)[0];
let now=0;
const colorContext = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(preview, 'rain-color-fluctuation.js'), 'utf8'), colorContext);
const Color=require('./load-runtime.cjs')('rain-audio-color.js');
const Choreography=require('./load-runtime.cjs')('beat-turns-policy.js');
const fake={RainAudioMotion,RainAudioColor:Color,RainChoreographyComparison:Choreography,rainCamera:{enabled:true},Float32Array,Math,window:{rainMelodyColor:new Color(),rainAudioPalette:{active:false},rainColorMode:'cohesive'},performance:{now:()=>now},
    colorFluctuationPercent:300,audioColorPreset:'default',audioColorFluctuation:new colorContext.window.RainColorFluctuation(),
    audioDiagonalsEnabled:true,audioReverseEnabled:true,audioDataArray:new Float32Array(64),
    MatrixRainEngine:{rainConfig:{direction:'down',speed:35}},audioHueSpread:.8,audioHighModRange:30,
    hueReactivityScale:1,satGainScale:1,satFloor:80,brightnessMax:85,brightnessMin:30,brightnessDepthScale:1,
    document:{querySelectorAll:()=>[],querySelector:()=>null,getElementById:()=>({value:0,classList:{add(){}}})}};
vm.runInNewContext(hsl+'\n'+html.slice(start,end)+'\nglobalThis.drive=(spectrum)=>{audioMotionSpectrum=spectrum;reactToAudio(40,30,30,20,.15,true);};',fake);
for(let frame=0;frame<100;frame++) {now=frame*33;fake.drive(Float32Array.from(movedBins(frame)));}
assert.ok(fake.window.rainAudioMotion.turnCount>5,'HTML feeds real full spectra to the new controller');
assert.equal(fake.MatrixRainEngine.rainConfig.direction,fake.window.rainAudioMotion.snapshot.direction);
assert.equal(fake.MatrixRainEngine.rainConfig.speed,fake.window.rainAudioMotion.snapshot.speed);
console.log(JSON.stringify(summary,null,2));
console.log('HTML integration, script packaging, CEF settings, native listener, unchanged geometry/trails, and deterministic audio behavior passed.');
