const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const codec=require('./load-runtime.cjs')('rain-settings-codec.js');
const fixture=require('./settings-codec-ui.test.cjs');
const controls=new Map();
const el=id=>{if(!controls.has(id))controls.set(id,{value:0,checked:false,onchange(){},oninput(){}});return controls.get(id);};
const ctx={console,RainSettingsCodec:codec,localStorage:{setItem(){}},
 document:{getElementById:el,querySelector(){return{onclick(){}};}},
 window:{addEventListener(){},matrixRainTrails:{...fixture.trails},matrixRainRendering:{...fixture.render,glow:.15,contrast:1},
 rainAllDirections:{mode:'directed',manualMode:'directed',followMusic:false,enabled:false,setMode(v){this.mode=this.manualMode=v;this.enabled=v!=='directed';},setFollowMusic(v){this.followMusic=v;}},
 RainMediaCharacters:{mode:'original',density:50,setMode(v){this.mode=v;},setDensity(v){this.density=v;}}},
 MatrixRainEngine:{rainConfig:{...fixture.rain}},reverseFlowMultiplier:1,
 audioColorPreset:fixture.audio.preset,audioReverseEnabled:fixture.audio.beatTurns,
 colorFluctuationPercent:fixture.audio.fluctuation,hueReactivityScale:.6,satGainScale:.6,brightnessDepthScale:.8,
 audioHueSpread:.8,audioHighModRange:16,satFloor:45,brightnessMin:52,brightnessMax:80,
 rainCamera:{...fixture.camera,speeds:{showcase:.25,corkscrew:.3,gyroscope:.2},setEnabled(v){this.enabled=v;},setMode(v){this.mode=v;},refreshControls(){}},
 rainMedia:{options:{influence:100,exposure:100,contrast:100,gamma:100},saveAppearance(){},refresh(){}}};
for(const id of ['setRainPattern','updateRainSpeed','updateRainIntensity','updateRainDensity','updateCharacterSize','updateCharacterSet','updateRainColors','toggleReverseFlow','toggleAudioReverse','updateRainDirection','setColorPreset','updateColorFluctuation','updateHueReactivity','updateSaturationGain','updateBrightnessDepth'])ctx[id]=()=>{};
ctx.window.rainMedia=ctx.rainMedia;
for(const [id,key] of Object.entries({rainSpeed:'speed',rainIntensity:'intensity',rainDensity:'density',characterSize:'fontSize',primaryColor:'primary',secondaryColor:'secondary',characterSet:'characterSet',customCharacters:'customCharacters'}))el(id).value=fixture.rain[key];
vm.runInNewContext(fs.readFileSync('rain-settings-share.js','utf8'),ctx);
const share=ctx.window.rainSettingsShare;
assert.deepEqual(codec.decode(share.export(fixture.name)),fixture,'Capture includes real controller state');
for(const mode of ['original','shading','braille','lines']){
 const next=structuredClone(fixture);next.rain.flow='crossflow';next.audio.flowFollow=true;next.media.characters=mode;next.media.dotDensity=87;
 share.import(codec.encode(next));
 assert.equal(ctx.window.rainAllDirections.enabled,true);
 assert.equal(ctx.window.RainMediaCharacters.mode,mode);
 assert.equal(ctx.window.RainMediaCharacters.density,87);
 assert.deepEqual(Object.keys(ctx.rainMedia.options).sort(),['contrast','exposure','gamma','influence'],'Shape choices do not leak into tone options');
 assert.deepEqual(codec.decode(share.export(fixture.name)),next,'Applied choices recapture into the same code');
}
share.apply(share.defaults());
assert.equal(ctx.window.rainAllDirections.enabled,false,'Reset restores Single direction');
assert.equal(ctx.window.RainMediaCharacters.mode,'shading');assert.equal(ctx.window.RainMediaCharacters.density,50);
assert.equal(ctx.window.rainAllDirections.followMusic,true,'Reset enables musical flow only when audio is started');
ctx.window.rainAllDirections.mode='crossflow';
assert.equal(share.capture().rain.flow,'directed','Export saves manual intent, not the passing audio formation');
const before=JSON.stringify(share.capture());
const bad=structuredClone(fixture);bad.media.dotDensity=-1;assert.throws(()=>share.apply(bad));
assert.equal(JSON.stringify(share.capture()),before,'Invalid shape data cannot partially apply');
const retained=ctx.window.RainMediaCharacters;delete ctx.window.RainMediaCharacters;
assert.throws(()=>share.apply(fixture),/still loading/,'Missing runtime fails before mutation');
ctx.window.RainMediaCharacters=retained;assert.equal(JSON.stringify(share.capture()),before);
console.log('PASS flow and four picture modes capture/apply/reset, tone isolation and rejected-import atomicity.');
