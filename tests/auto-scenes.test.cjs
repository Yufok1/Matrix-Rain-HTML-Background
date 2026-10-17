const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const read = name => fs.readFileSync(name, 'utf8');
const html = read('matrix-rain-utility-suite.html');
function source(name) {
    const matches = html.match(new RegExp('^        function ' + name + '\\([^\\n]*\\) \\{[\\s\\S]*?^        \\}', 'gm'));
    assert.ok(matches?.length, name);
    return matches.at(-1);
}
const elements = new Map();
function element(id) {
    if (!elements.has(id)) elements.set(id, {value:'', checked:false, style:{}, textContent:'',
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
    scenes.reset();previous=json();
    for(let i=0;i<180;i++){
        context.orchestrateRandomChange();settle();
        assert.equal(json(),previous,'Auto cannot modify an audio session');
    }
    assert.equal(scenes.next('depth'),false,'Direct Auto steps are excluded during audio too');
    context.autoOrchestratorActive=context.window.autoOrchestratorActive=false;
    context.toggleAutoOrchestrator();assert.equal(context.autoOrchestratorActive,false,'Handler cannot bypass audio exclusion');
    context.audioReactiveActive=context.window.audioReactiveActive=false;
    context.toggleAutoOrchestrator();assert.equal(context.autoOrchestratorActive,true,'Auto starts after audio stops');
    context.startAutoOrchestrator();context.startAutoOrchestrator();
    assert.equal(timers.size,1,'Only one scheduled scene change');
    assert.equal([...timers.values()][0].delay,12000);
    settle();previous=json();
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
    assert.equal([...timers.values()][0].delay,1000,'The scene scheduler accepts one second');
    assert.equal(storage.get('matrixRain.autoSceneInterval'),'1');
    assert.equal(snapshot().auto.interval,1,'One-second timing is exported');
    scenes.setInterval(-1);assert.equal(scenes.intervalSeconds,1,'One second is the hard minimum');
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
            assert.ok(Number(numeric.fontSize)>=14&&Number(numeric.fontSize)<=18);
        }
    }
    // Restored depth changes keep the existing angle, even an oblique view.
    for(const yaw of [25,80,-155]){
        scenes.reset();context.camera.setMode('fixed');context.camera.depthTransition=null;
        context.camera.enabled=true;context.camera.perspective=1;
        context.camera.yaw=yaw;context.camera.pitch=-20;context.camera.roll=45;
        context.MatrixRainEngine.rainConfig.direction='down';context.window.rainAllDirections.setMode('directed');
        scenes.next('depth');assert.equal(scenes.description,'depth');settle();
        assert.deepEqual([context.camera.yaw,context.camera.pitch,context.camera.roll],[yaw,-20,45]);
    }
    console.log('PASS 1200 connected random shifts; restored full scene choices, retained viewpoint, audio exclusion, adjustable/exported timing, Stop/Resume and timer ownership.');
}
lifecycle().catch(error=>{console.error(error);process.exitCode=1;});
