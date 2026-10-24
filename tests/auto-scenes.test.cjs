const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const read = name => fs.readFileSync(name, 'utf8');
const html = read('matrix-rain-utility-suite.html');
function source(name) {
    const matches = html.match(new RegExp('^        (?:async )?function ' + name + '\\([^\\n]*\\) \\{[\\s\\S]*?^        \\}', 'gm'));
    assert.ok(matches?.length, name);
    return matches.at(-1);
}
const elements = new Map();
function element(id) {
    if (!elements.has(id)) elements.set(id, {value:'', checked:false,disabled:false,style:{},textContent:'',previousElementSibling:{style:{}},
        classList:{add(){},remove(){}}, setAttribute(){}, parentElement:{before(){}},
        querySelector:selector=>element(selector.replace(/^#/,'')), querySelectorAll:()=>[]});
    return elements.get(id);
}
let seed = 1627, timerId = 0;
const timers = new Map(), writes = [];
const storage = new Map([['matrixRain.flow','directed'], ['matrixRain.trails.optIn','1'],
    ['matrixRain.trails',JSON.stringify({enabled:false,stepped:true,minimum:12,maximum:100})],
    ['matrixRain.rendering',JSON.stringify({quality:'low',sharp:true,smooth:true,glow:.15,contrast:1})]]);
const context = vm.createContext({
    window:{addEventListener:(event,callback)=>callback()},
    document:{getElementById:element, createElement:()=>element('panel-'+elements.size),
        querySelector:()=>element('pattern'), querySelectorAll:()=>[]},
    localStorage:{getItem:key=>storage.get(key)??null, removeItem:key=>storage.delete(key),
        setItem(key,value){writes.push(key);storage.set(key,String(value));}},
    Math:Object.assign(Object.create(Math), {random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}}),
    console:{log(){},error(){}}, performance, TextEncoder, TextDecoder, btoa, atob,
    setTimeout(callback,delay){const id=++timerId;timers.set(id,{callback,delay});return id;},
    clearTimeout:id=>timers.delete(id),
    MatrixRainEngine:{rainConfig:{pattern:'classic',density:50,fontSize:10,direction:'down',characterSet:'katakana',
        speed:35,intensity:70,primaryColor:'#00ff41',secondaryColor:'#00cc33'},logActivity(){}},
    matrixCanvas:{width:800,height:600,style:{}},matrixCtx:{save(){},restore(){},clearRect(){}},
    rainCameraGPU:{invalidate:false,hide(){}},rainMotion:{planar:'down',drops:[]},rainFocalLength:500,
    recomputeActiveColumnsMask(){},stopMatrixAnimation(){},startMatrixAnimation(){},updateModeButtons(){},
    autoOrchestratorActive:false,autoOrchestratorInterval:null,audioReactiveActive:false,reverseFlowMultiplier:1,
    audioStream:null,audioContext:null,audioAnimationFrame:null,rainAudioRequestVersion:0,
    audioColorPreset:'zen',audioReverseEnabled:false,colorFluctuationPercent:100,hueReactivityScale:.6,
    satGainScale:.6,brightnessDepthScale:.8,audioHueSpread:.8,audioHighModRange:16,satFloor:45,brightnessMin:52,brightnessMax:80,
    rainAudioPalette:{active:false}
});
context.window.rainAudioPalette = context.rainAudioPalette;
// Run the actual rendering/trail controls: Auto scenes must refresh them without
// calling handlers that save a random choice over the user's stored preferences.
vm.runInContext(read('render-settings.js'), context);
vm.runInContext('(()=>{'+read('trails/rain-trail-lengths.js').replace('export class','class')+'\n'+
    read('trails/rain-trails.js').replace(/^import .*\r?\n/,'')+'})();', context);
context.window.addEventListener = ()=>{};
for (const file of ['rain-camera-motion.js','rain-camera.js','rain-all-directions.js','rain-auto-scenes.js','rain-settings-codec.js']) vm.runInContext(read(file),context);
vm.runInContext('globalThis.camera=rainCamera;',context);
context.camera.marks.push({streamId:0,x:10,y:20,z:150,color:'#123456',frame:0,trailLength:40});
context.rainMedia = context.window.rainMedia = {options:{influence:100,exposure:100,contrast:100,gamma:100},pause(){},resume(){}};
context.window.RainMediaCharacters = {mode:'shading',density:50};
context.RainSettingsCodec = context.window.RainSettingsCodec;
vm.runInContext(read('rain-settings-share.js'),context);
vm.runInContext(read('rain-session-controls.js'),context);
vm.runInContext(['updateRainConfig','updateRainDirection','orchestrateRandomChange',
    'scheduleNextChange','stopAutoOrchestrator','startAutoOrchestrator','toggleAutoOrchestrator'].map(source).join('\n'),context);
element('customCharacters').value = '雨∞';
element('characterSet').value='katakana';element('customCharacters').style.display='none';
const scenes=context.window.rainAutoScenes;scenes.apply({kind:'initialize'});
function settle(){for(let i=0;i<301;i++){context.camera.advanceTransitions(1/60);scenes.advance(1/60);}}
const snapshot = () => context.window.rainSettingsShare.capture();
const json = () => JSON.stringify(snapshot());
const sets = new Map();
const record = (key,value) => {if(!sets.has(key))sets.set(key,new Set());sets.get(key).add(value);};
const savedStorage = JSON.stringify([...storage]);
writes.length = 0;

context.autoOrchestratorActive = true;
for (let i=0;i<1200;i++) {
    const angles=[context.camera.yaw,context.camera.pitch,context.camera.roll];
    const before=snapshot();
    context.orchestrateRandomChange();
    assert.deepEqual([context.camera.yaw,context.camera.pitch,context.camera.roll],angles,'No random camera-angle assignment');
    settle();
    const s=snapshot();
    assert.equal(s.render.quality,'low','Quality tier is never randomized');
    assert.equal(s.rain.flow,context.window.rainAllDirections.mode,'Export matches the actual flow');
    assert.equal(s.rain.speed,101-context.MatrixRainEngine.rainConfig.speed,'Speed slider matches the runtime delay');
    assert.equal(s.rain.density,context.MatrixRainEngine.rainConfig.density);
    assert.equal(s.rain.fontSize,context.MatrixRainEngine.rainConfig.fontSize);
    assert.equal(element('charSizeDisplay').textContent,s.rain.fontSize+'px');
    assert.equal(element('customCharacters').style.display,s.rain.characterSet==='custom'?'block':'none');
    assert.equal(context.MatrixRainEngine.rainConfig.characterSet,s.rain.characterSet==='custom'?'雨∞':s.rain.characterSet);
    if(!s.camera.enabled)assert.ok(['down','up','left','right'].includes(s.rain.direction),'Flat view cannot move along Z');
    else {
        record('camera mode',s.camera.mode);

        for(const field of ['sharp','smooth','glow','contrast'])record(field,s.render[field]);
        for(const field of ['enabled','stepped','minimum','maximum'])record('trail '+field,s.trails[field]);
        assert.equal(element('render-sharp').checked,s.render.sharp);
        assert.equal(element('render-smooth').checked,s.render.smooth);
        assert.equal(Number(element('render-glow').value),s.render.glow);
        assert.equal(Number(element('render-contrast').value),s.render.contrast);
        assert.equal(element('trail-variety').checked,s.trails.enabled);
        assert.equal(element('trail-stepped').checked,s.trails.stepped);
        assert.equal(Number(element('trail-shortest').value),s.trails.minimum);
        assert.equal(Number(element('trail-longest').value),s.trails.maximum);
    }
    for(const field of ['flow','reverse','density','fontSize','speed','intensity','pattern','characterSet','direction'])record(field,s.rain[field]);
    record('camera enabled',s.camera.enabled);
    const changed=['density','fontSize','speed','intensity','primary','secondary','pattern','characterSet','direction','flow','reverse'].filter(k=>s.rain[k]!==before.rain[k]);
    assert.ok(changed.length<=2,'One related visual family per shift: '+changed);
    const encoded=context.RainSettingsCodec.encode(s);
    assert.equal(JSON.stringify(context.RainSettingsCodec.decode(encoded)),JSON.stringify(s),'Random scene remains shareable');
    const mark=context.camera.marks[0];
    assert.deepEqual([mark.x,mark.y,mark.z,mark.color],[10,20,150,'#123456'],'Existing glyph positions/colors stay fixed');
}
for(const [field,values] of sets)assert.ok(values.size>1,'Control must actually vary: '+field);
assert.equal(sets.get('flow').size,3);
assert.equal(sets.get('camera mode').size,4);
assert.equal(sets.get('direction').size,6);
assert.equal(sets.get('characterSet').size,6,'Include supplied custom characters');
assert.equal(JSON.stringify([...storage]),savedStorage,'Saved preferences are unchanged');
assert.deepEqual(writes,[]);

async function lifecycle() {
    let previous=json();
    context.autoOrchestratorActive=false;context.orchestrateRandomChange();assert.equal(json(),previous);
    context.autoOrchestratorActive=true;context.audioReactiveActive=true;context.window.audioReactiveActive=true;
    scenes.reset();settle();
    const config=context.MatrixRainEngine.rainConfig,flow=context.window.rainAllDirections;
    const protectedState=()=>JSON.stringify({direction:config.direction,speed:config.speed,intensity:config.intensity,
        primary:config.primaryColor,secondary:config.secondaryColor,pattern:config.pattern,characters:config.characterSet,
        reverse:context.reverseFlowMultiplier});
    const spatialKinds=new Set(['hold viewpoint','align viewpoint','prepare flat','depth','camera','flow','density','size','render','tails']);
    const combined=new Map(),forbidden=['direction','reverse','pace','palette','pattern','characters'];
    for(const kind of forbidden){
        const before=protectedState();
        assert.equal(scenes.apply({kind,value:'up'}),false,`Direct ${kind} cannot override audio`);
        assert.equal(scenes.next(kind),false,`Requested ${kind} cannot override audio`);
        assert.equal(protectedState(),before);
    }
    for(let i=0;i<2100;i++){
        // Audio is allowed to change its own output on every scene decision.
        // Auto must preserve that exact output, rather than merely reapply a
        // stale initial snapshot after each interpolation.
        config.direction=['down','right','toward','up','away','left'][i%6];
        config.speed=15+i%71;config.intensity=30+i%71;
        config.primaryColor=`hsl(${i%360}, 91%, 51%)`;config.secondaryColor=`hsl(${(i+4)%360}, 89%, 50%)`;
        config.pattern='classic';config.characterSet='katakana';
        context.reverseFlowMultiplier=i%2?-1:1;
        const before=protectedState();context.orchestrateRandomChange();
        if(scenes.description==='size'){
            const change=scenes.tweens.find(t=>t.object===config&&t.key==='fontSize');
            assert.ok(change&&Math.abs(change.to-change.from)>=2,'Combined size shifts vary within the readable middle range');
        }
        settle();
        assert.equal(protectedState(),before,'Combined Auto preserves every current musical output and manual reverse');
        assert.ok(spatialKinds.has(scenes.description),'Combined generator selects a spatial family');
        for(const [field,value]of Object.entries({density:config.density,size:config.fontSize,depth:context.camera.enabled,
            camera:context.camera.mode,flow:flow.mode,sharp:context.window.matrixRainRendering.sharp,smooth:context.window.matrixRainRendering.smooth,
            glow:context.window.matrixRainRendering.glow,tails:context.window.matrixRainTrails.enabled})){
            if(!combined.has(field))combined.set(field,new Set());combined.get(field).add(value);
        }
        const mark=context.camera.marks[0];
        assert.deepEqual([mark.x,mark.y,mark.z,mark.color],[10,20,150,'#123456'],'Combined modes preserve existing glyph history');
    }
    for(const [field,values]of combined)if(field!=='smooth')assert.ok(values.size>1,'Combined Auto still changes '+field);
    // Recheck a delayed closing step against the latest audio heading. A Z
    // heading or six-axis manual flow cannot be replaced merely to flatten.
    for(const mode of ['directed','counterflow','crossflow'])for(const direction of ['down','toward']){
        scenes.reset();context.camera.enabled=true;context.camera.perspective=1;context.camera.depthTransition=null;
        context.camera.setMode('fixed');flow.setMode(mode);config.direction=direction;
        const before=protectedState();
        const allowed=mode==='directed'&&direction==='down';
        assert.equal(scenes.apply({kind:'depth',value:false}),allowed,'Flatten only a compatible heading and manual flow');
        assert.equal(protectedState(),before);settle();
    }
    scenes.reset();context.camera.enabled=true;context.camera.perspective=1;context.camera.depthTransition=null;
    context.camera.setMode('fixed');flow.setMode('directed');config.direction='down';
    context.rainMotion.drops=[{lastStepDirection:'toward'}];
    scenes.queue.push({kind:'depth',value:false});
    assert.equal(scenes.next(),false,'A queued close rechecks actual head headings, not only the current conductor heading');
    assert.equal(context.camera.enabled,true);assert.equal(config.direction,'down');
    context.rainMotion.drops[0].lastStepDirection='right';
    assert.equal(scenes.apply({kind:'depth',value:false}),true,'Closing can proceed once active heads are planar');settle();
    context.camera.enabled=true;context.camera.perspective=1;context.camera.depthTransition=null;
    context.rainMotion.drops[0].lastStepDirection='away';context.window.activeColumnsMask=[false];
    assert.equal(scenes.apply({kind:'depth',value:false}),true,'Retired inactive Z heads do not block flattening forever');settle();
    context.rainMotion.drops=[];delete context.window.activeColumnsMask;
    scenes.reset();context.camera.enabled=true;context.camera.perspective=1;context.camera.depthTransition=null;
    context.camera.setMode('fixed');flow.setMode('directed');config.direction='toward';
    assert.equal(scenes.next('depth'),true,'A depth route first prepares a compatible planar state');
    assert.equal(scenes.preparingFlat,true,'Preparation signals audio to normalize heading through its own controller');
    assert.ok(scenes.queue.some(step=>step.kind==='depth'&&step.value===false),'Preparation retains the intended closing step');
    assert.equal(config.direction,'toward','Auto does not directly force audio heading during preparation');
    settle();config.direction='down';
    for(let step=0;step<8&&scenes.queue.length;step++){scenes.next();settle();}
    assert.equal(context.camera.enabled,false,'A compatible prepared route eventually closes the same camera');
    assert.equal(scenes.preparingFlat,false,'Preparation clears after the complete close transition');

    // The startup handler must discard both stale future musical steps and
    // active pace tweens before an actual capture request waits for permission.
    context.audioReactiveActive=context.window.audioReactiveActive=false;scenes.reset();settle();
    scenes.apply({kind:'pace'});scenes.apply({kind:'density'});
    assert.ok(scenes.tweens.some(t=>t.object===config&&t.key==='speed'));
    scenes.queue.push({kind:'direction',value:'up'},{kind:'palette'},{kind:'flow',value:'crossflow'},{kind:'size'});
    let finishCapture,analyzed=0;
    const track={enabled:true,readyState:'live',events:{},stop(){this.readyState='ended';},addEventListener(name,fn){this.events[name]=fn;}};
    const stream={getAudioTracks:()=>[track],getTracks:()=>[track]};
    class AudioContext{
        constructor(){this.state='running';}
        createAnalyser(){return{frequencyBinCount:1024};}
        createMediaStreamSource(){return{connect(){}};}
        async suspend(){this.state='suspended';}async resume(){this.state='running';}close(){this.state='closed';}
    }
    context.navigator={mediaDevices:{getDisplayMedia:()=>new Promise(resolve=>{finishCapture=resolve;})}};
    Object.assign(context,{audioUsesLocalVideo:false,audioAnalyser:null,audioBufferLength:0,audioDataArray:null,
        cancelAnimationFrame(){},analyzeAudio(){analyzed++;},resetAudioMotion(){}});
    Object.assign(context.window,{isSecureContext:true,AudioContext});
    vm.runInContext(['canCaptureRainAudio','updateModeButtons','toggleAudioReactive','stopAudioReactive'].map(source).join('\n'),context);
    config.primaryColor='#00ff41';config.secondaryColor='#00cc33';
    const pendingCapture=context.toggleAudioReactive();
    assert.equal(context.autoOrchestratorActive,true,'Actual audio startup keeps Auto active');
    assert.equal(context.audioReactiveActive,true);assert.equal(context.window.rainAudioStarting,true);
    assert.ok(!scenes.tweens.some(t=>t.object===config&&['speed','intensity'].includes(t.key)),'Startup immediately cancels stale pace tweens');
    assert.ok(scenes.tweens.some(t=>t.object===config&&t.key==='density'),'Startup preserves in-flight spatial interpolation');
    assert.deepEqual(Array.from(scenes.queue,t=>t.kind),['flow','size'],'Startup removes stale queued musical changes while preserving spatial flow');
    settle();const owned=protectedState();scenes.next('size');settle();
    assert.equal(protectedState(),owned,'Pending capture retains musical ownership');
    context.startAutoOrchestrator();assert.equal(timers.size,1,'Scene timer stays live while capture is pending');
    assert.equal(element('autoOrchestratorBtn').disabled,false,'Auto remains operable while sharing is pending');
    finishCapture(stream);await pendingCapture;assert.equal(analyzed,1);assert.equal(context.window.rainAudioStarting,false);

    // Real audio-controller integration: feed the unchanged HTML reactToAudio
    // function while Auto changes spatial families. Music output remains the
    // sole writer of its fields, and selected manual flow is never replaced.
    const load=require('./load-runtime.cjs');let audioNow=0;
    Object.assign(context,{RainAudioMotion:load('rain-audio-motion.js'),RainAudioColor:load('rain-audio-color.js'),
        RainChoreographyComparison:load('beat-turns-policy.js'),performance:{now:()=>audioNow}});
    vm.runInContext(read('rain-color-fluctuation.js'),context);
    context.audioColorFluctuation=new context.window.RainColorFluctuation();
    context.window.rainMelodyColor=new context.RainAudioColor();context.window.rainColorMode='cohesive';
    const start=html.indexOf('        const audioMotion ='),end=html.indexOf('        function drawAudioVisualizer(',start);
    vm.runInContext(source('hslToHex')+'\n'+html.slice(start,end)+'\nglobalThis.feedAudio=spectrum=>{audioMotionSpectrum=spectrum;reactToAudio(80,70,65,40,.25,true);};',context);
    context.audioReverseEnabled=true;flow.setMode('counterflow');
    const headings=new Set(),speeds=new Set();
    for(let frame=0;frame<2400;frame++){
        audioNow=frame*1000/30;
        const spectrum=new Float32Array(64).fill(.012);spectrum[[2,14,25,35,46,60][Math.floor(frame/15)%6]]=.4;
        context.feedAudio(spectrum);const before=protectedState();
        if(frame%11===0)context.orchestrateRandomChange();
        context.camera.advanceTransitions(1/30);scenes.advance(1/30);
        assert.equal(protectedState(),before,'Spatial Auto never overwrites the real audio controller output');
        assert.equal(config.direction,context.window.rainAudioMotion.snapshot.direction);
        assert.equal(config.speed,context.window.rainAudioMotion.snapshot.speed);
        headings.add(config.direction);speeds.add(config.speed);
    }
    assert.ok(headings.size>2,'Actual audio still steers while scenes evolve');assert.ok(speeds.size>20,'Actual audio still drives varied speed');
    // Replay the same real soundtrack analysis twice with equal depth capability.
    // The spatial run changes actual scene controls; all musical outputs must
    // remain bit-for-bit identical to standalone audio, not merely plausible.
    function audioTrace(withScenes){
        scenes.reset();context.camera.enabled=true;context.camera.perspective=1;context.camera.depthTransition=null;
        context.camera.setMode('fixed');flow.setMode('counterflow');context.reverseFlowMultiplier=-1;
        Object.assign(config,{direction:'down',speed:35,intensity:70,pattern:'classic',characterSet:'katakana',primaryColor:'#00ff41',secondaryColor:'#00cc33'});
        context.resetAudioMotion();const trace=[],kinds=new Set();
        for(let frame=0;frame<2400;frame++){
            audioNow=frame*1000/30;
            const spectrum=new Float32Array(64).fill(.012);spectrum[[2,14,25,35,46,60][Math.floor(frame/15)%6]]=.4;
            context.feedAudio(spectrum);
            if(withScenes&&frame%47===0){scenes.next(['density','size','render','tails','camera'][Math.floor(frame/47)%5]);kinds.add(scenes.description);}
            context.camera.advanceTransitions(1/30);scenes.advance(1/30);
            assert.equal(context.camera.enabled,true,'Parity replay retains the same six-heading audio capability');
            trace.push(protectedState());
        }
        if(withScenes)assert.ok(kinds.size>=4,'Parity replay actually changes several spatial families');
        return trace;
    }
    assert.deepEqual(audioTrace(true),audioTrace(false),'Identical spectra produce exactly identical musical outputs with or without spatial Auto');
    settle();previous=json();
    context.window.rainSessionControls.stop();
    assert.equal(context.audioReactiveActive,false);assert.equal(context.autoOrchestratorActive,false);
    assert.equal(context.window.rainSessionControls.audioPaused,true,'Paused audio retains musical ownership');
    assert.equal(timers.size,0);assert.equal(track.enabled,false);
    const pausedTweens=JSON.stringify(scenes.tweens.map(t=>[t.key,t.elapsed,t.delay]));
    context.orchestrateRandomChange();assert.equal(json(),previous,'Stop prevents either session changing the current look');
    assert.equal(JSON.stringify(scenes.tweens.map(t=>[t.key,t.elapsed,t.delay])),pausedTweens);
    assert.equal(scenes.next('pace'),false,'Paused audio does not temporarily surrender musical ownership');
    await context.window.rainSessionControls.resume();
    assert.equal(context.audioReactiveActive,true);assert.equal(context.autoOrchestratorActive,true);
    assert.equal(context.window.audioReactiveActive,true);assert.equal(context.window.autoOrchestratorActive,true);
    assert.equal(track.enabled,true);assert.equal(timers.size,1,'Combined Resume restores exactly one Auto timer');
    assert.equal(json(),previous,'Combined Resume preserves the paused appearance');
    const [combinedId,combinedTimer]=[...timers][0];timers.delete(combinedId);combinedTimer.callback();settle();
    assert.equal(timers.size,1,'Combined timer reschedules without duplication');
    context.toggleAutoOrchestrator();assert.equal(context.autoOrchestratorActive,false);assert.equal(context.audioReactiveActive,true,'Stopping Auto keeps audio running');
    context.toggleAutoOrchestrator();assert.equal(context.autoOrchestratorActive,true);assert.equal(context.audioReactiveActive,true,'Auto can restart independently during audio');
    await context.toggleAudioReactive();
    assert.equal(context.audioReactiveActive,false);assert.equal(context.autoOrchestratorActive,true,'Stopping audio keeps Auto running');
    assert.equal(scenes.syncAudioOwnership(),false,'Stopping audio restores full scene scope');
    scenes.reset();settle();
    assert.equal(scenes.apply({kind:'pace'}),true,'Pace is available after audio stops');settle();
    assert.equal(scenes.apply({kind:'direction',value:'right'}),true);assert.equal(config.direction,'right');
    assert.equal(scenes.apply({kind:'characters',value:'binary'}),true);assert.equal(config.characterSet,'binary');
    assert.equal(scenes.apply({kind:'palette'}),true);
    assert.equal(scenes.apply({kind:'flow',value:'crossflow'}),true);settle();assert.equal(flow.mode,'crossflow');
    context.autoOrchestratorActive=context.window.autoOrchestratorActive=false;
    context.toggleAutoOrchestrator();assert.equal(context.autoOrchestratorActive,true,'Auto still starts independently');
    context.startAutoOrchestrator();context.startAutoOrchestrator();
    assert.equal(timers.size,1,'Only one scheduled scene change');
    assert.equal([...timers.values()][0].delay,12000);
    settle();scenes.cancelPlan();
    scenes.queue.push({kind:'direction',value:config.direction==='down'?'right':'down'});
    previous=json();
    context.window.rainSessionControls.stop();
    assert.equal(timers.size,0,'Emergency Stop cancels scene changes');
    context.orchestrateRandomChange();assert.equal(json(),previous);
    await context.window.rainSessionControls.resume();
    assert.equal(json(),previous,'Resume retains the paused scene');
    assert.equal(timers.size,1);
    assert.equal(context.audioReactiveActive,false,'Auto resume does not start audio');
    assert.equal(context.autoOrchestratorActive,true);
    const [id,pending]=[...timers][0];timers.delete(id);pending.callback();
    settle();assert.notEqual(json(),previous,'Resumed timer produces another random scene');
    assert.equal(timers.size,1);
    context.autoOrchestratorActive=false;context.stopAutoOrchestrator();
    previous=json();context.orchestrateRandomChange();assert.equal(json(),previous,'Stop auto scenes keeps the current look');
    assert.equal(timers.size,0);
    assert.equal(context.audioReactiveActive,false,'Stopping Auto does not start audio');
    context.audioReactiveActive=context.window.audioReactiveActive=false;
    context.autoOrchestratorActive=true;scenes.setInterval(7);
    assert.equal([...timers.values()][0].delay,7000);assert.equal(storage.get('matrixRain.autoSceneInterval'),'7');
    assert.equal(snapshot().auto.interval,7,'Timing is exported');
    scenes.setInterval(1);assert.equal(scenes.intervalSeconds,1);
    assert.equal([...timers.values()][0].delay,1000);
    assert.equal(snapshot().auto.interval,1);
    scenes.setInterval(.1);assert.equal(scenes.intervalSeconds,.1);
    assert.equal([...timers.values()][0].delay,100);
    assert.equal(storage.get('matrixRain.autoSceneInterval'),'0.1');
    assert.equal(snapshot().auto.interval,.1);
    assert.equal(timers.size,1);
    context.stopAutoOrchestrator();context.scheduleNextChange(true);
    assert.equal(timers.size,1);
    assert.ok([...timers.values()].every(timer=>timer.delay===100));
    context.stopAutoOrchestrator();context.scheduleNextChange();
    scenes.setInterval(-1);assert.equal(scenes.intervalSeconds,.1);
    scenes.setInterval(0);assert.equal(scenes.intervalSeconds,12);
    scenes.setInterval(120);assert.equal(scenes.intervalSeconds,60);
    context.autoOrchestratorActive=false;context.stopAutoOrchestrator();
    // Real range inputs return strings, unlike the initial numeric config.
    // Import/manual input must not concatenate density, intensity or speed.
    scenes.reset();context.camera.enabled=true;context.camera.perspective=1;context.camera.depthTransition=null;
    const numeric=context.MatrixRainEngine.rainConfig;
    for(const kind of ['density','pace','size']){
        Object.assign(numeric,{density:'37',speed:'40',intensity:'70',fontSize:'16'});
        scenes.apply({kind});
        for(let frame=0;frame<301;frame++){
            scenes.advance(1/60);
            assert.ok(Number.isFinite(Number(numeric.density))&&Number(numeric.density)<=58);
            assert.ok(Number(numeric.intensity)>=62&&Number(numeric.intensity)<=78);
            assert.ok(Number(numeric.speed)>=30&&Number(numeric.speed)<=50);
            assert.ok(Number(numeric.fontSize)>=14&&Number(numeric.fontSize)<=20);
        }
    }
    // Readable oblique views stay intact. Edge-on views align the same world
    // before flattening, preserving roll and all glyph history throughout.
    for(const yaw of [25,80,-155]){
        scenes.reset();context.camera.setMode('fixed');context.camera.depthTransition=null;
        context.camera.enabled=true;context.camera.perspective=1;
        context.camera.yaw=yaw;context.camera.pitch=-20;context.camera.roll=45;
        context.MatrixRainEngine.rainConfig.direction='down';context.window.rainAllDirections.setMode('directed');
        const target=context.window.RainCameraMotion.safePlanarAngles(yaw*Math.PI/180,-20*Math.PI/180,45*Math.PI/180);
        scenes.next('depth');settle();
        for(let step=0;step<8&&scenes.queue.length;step++){scenes.next();settle();}
        assert.equal(context.camera.enabled,false);assert.equal(context.camera.perspective,0);
        assert.equal(context.camera.roll,45,'Flat alignment keeps the established roll');
        assert.ok(Math.abs(context.camera.yaw-target.yaw*180/Math.PI)<1e-8);
        assert.ok(Math.abs(context.camera.pitch-target.pitch*180/Math.PI)<1e-8);
        const r=context.camera.viewRotation();
        assert.ok(Math.hypot(r[0],r[3])>=.65-1e-8&&Math.hypot(r[1],r[4])>=.65-1e-8,'Both planar rain axes remain readable');
        assert.ok(Math.abs(r[8])>=.55-1e-8,'The flat plane never settles edge-on');
        if(yaw!==80)assert.deepEqual([context.camera.yaw,context.camera.pitch,context.camera.roll],[yaw,-20,45],'Already-readable views are unchanged');
    }
    console.log('PASS 1200 standalone + 2100 combined random shifts, 7200 real audio frames including exact standalone/combined parity, retained glyphs/viewpoint, musical ownership, stale plan cancellation, pending capture, independent toggles, combined/standalone Stop/Resume and adjustable/exported timer ownership.');
}
lifecycle().catch(error=>{console.error(error);process.exitCode=1;});
