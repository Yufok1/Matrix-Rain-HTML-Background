const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const storage=initial=>{const values=new Map(Object.entries(initial));return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};};
function loadFlow(localStorage){const window={};vm.runInNewContext(fs.readFileSync('rain-audio-flow.js','utf8')+'\n'+fs.readFileSync('rain-all-directions.js','utf8'),{window,localStorage});return window.rainAllDirections;}
for(const old of [{},{'matrixRain.flowFollowMusic':'true'}]){
 const saved=storage(old),flow=loadFlow(saved);assert.equal(flow.followMusic,false,'Fresh and upgraded sessions require opt-in');
 flow.setFollowMusic(true);assert.equal(loadFlow(saved).followMusic,true,'Explicit opt-in survives reload');
 flow.setFollowMusic(false);assert.equal(loadFlow(saved).followMusic,false,'Explicit opt-out survives reload');
}
function loadTrails(localStorage){
 const controls=new Map(),get=id=>{if(!controls.has(id))controls.set(id,{value:0,checked:false,disabled:false,textContent:''});return controls.get(id);};
 const panel={style:{},querySelector:selector=>get(selector)};
 const window={},document={createElement:()=>panel,getElementById:()=>({parentElement:{before(){}}})};
 const lengths=fs.readFileSync('trails/rain-trail-lengths.js','utf8').replace('export class','class');
 const ui=fs.readFileSync('trails/rain-trails.js','utf8').replace(/^import .*\r?\n/,'');
 vm.runInNewContext(lengths+'\n'+ui,{window,document,localStorage});
 return {trails:window.matrixRainTrails,toggle:get('#trail-variety')};
}
for(const old of [{},{'matrixRain.trails':JSON.stringify({minimum:24,maximum:90,enabled:true,stepped:false})}]){
 const saved=storage(old),first=loadTrails(saved);assert.equal(first.trails.enabled,false,'Fresh and upgraded tails are uniform');
 if(old['matrixRain.trails']){assert.equal(first.trails.minimum,24);assert.equal(first.trails.maximum,90);assert.equal(first.trails.stepped,false,'Migration preserves other trail preferences');}
 first.toggle.checked=true;first.toggle.onchange();assert.equal(loadTrails(saved).trails.enabled,true,'Explicit variable-tail opt-in survives reload');
 first.toggle.checked=false;first.toggle.onchange();assert.equal(loadTrails(saved).trails.enabled,false,'Explicit uniform-tail choice survives reload');
}
const window={addEventListener(){}};vm.runInNewContext(fs.readFileSync('rain-settings-codec.js','utf8'),{window});
vm.runInNewContext(fs.readFileSync('rain-settings-share.js','utf8'),{window,document:{getElementById(){}},RainSettingsCodec:window.RainSettingsCodec});
assert.equal(window.rainSettingsShare.defaults().audio.flowFollow,false,'Reset leaves Follow music off');
assert.equal(window.rainSettingsShare.defaults().trails.enabled,false,'Reset leaves variable tails off');
assert.doesNotMatch(fs.readFileSync('rain-all-directions.js','utf8'),/Follow music · expand \/ contract|Live expansion and gathering|musical expansion and contraction/,'Remove the wording, retain the feature');
console.log('PASS fresh, legacy, explicit opt-in, reload and Reset defaults for Follow music and variable tails.');
