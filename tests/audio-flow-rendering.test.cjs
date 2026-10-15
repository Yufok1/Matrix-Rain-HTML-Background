const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('matrix-rain-utility-suite.html','utf8');
const vectors={down:[0,1,0],up:[0,-1,0],right:[1,0,0],left:[-1,0,0],away:[0,0,1],toward:[0,0,-1]};
function setup(){
 const ctx=vm.createContext({window:{columnOrder:Array.from({length:80},(_,i)=>i)},MatrixRainEngine:{rainConfig:{direction:'down',fontSize:10}},
 matrixCanvas:{width:800,height:600},matrixDrops:Array(80).fill(20),matrixCtx:{globalAlpha:1,fillStyle:'#00ff41',fillText(){}},rainCameraGPU:{failed:false,lost:false,invalidate:false},reverseFlowMultiplier:1,performance,console});
 vm.runInContext(fs.readFileSync('rain-audio-flow.js','utf8'),ctx);
 vm.runInContext(fs.readFileSync('rain-all-directions.js','utf8'),ctx);
 vm.runInContext(html.slice(html.indexOf('        const rainMotion ='),html.indexOf('        function drawMatrixRain()')),ctx);
 vm.runInContext([...html.matchAll(/^        function recomputeActiveColumnsMask\(\) \{[\s\S]*?^        \}/gm)].at(-1)[0],ctx);
 vm.runInContext(fs.readFileSync('rain-camera.js','utf8').split("window.addEventListener('DOMContentLoaded'")[0],ctx);
 vm.runInContext(`globalThis.camera=rainCamera;globalThis.motion=rainMotion;globalThis.tick=(speed=1)=>{prepareRainMotion(10);for(let i=0;i<32;i++){const p=rainPosition(i,10);paintRainCharacter('カ',p.x,p.y,i,10);advanceRainPosition(i,10,speed);}rainCamera.frame++;};
 for(let i=0;i<80;i++){const p=rainPosition(i,10);p.depth=100+(i%4)*125;p.x=100+(i%16)*40;p.y=200+(i%3)*30;}`,ctx);
 return ctx;
}

// Music changes formation through actual branching heads; no whole-field jump.
for(const flat of [false,true])for(const reverse of [1,-1]){
 const ctx=setup(),flow=ctx.window.rainAllDirections;ctx.camera.enabled=!flat;ctx.reverseFlowMultiplier=reverse;ctx.tick();
 const old=ctx.camera.marks.map(m=>[m.x,m.y,m.z,m.color]);let forks=0,corners=0;
 const directions=['counterflow','crossflow','counterflow','directed'];
 for(const mode of directions){
  flow.applyMode(mode,true);assert.ok(flow.transitioning);
  for(let frame=0;frame<44;frame++){
   ctx.tick(1.3);forks=Math.max(forks,flow.forks.size);
   assert.ok(flow.forks.size<=32,'Temporary daughters are bounded by the live population');
   assert.ok(ctx.motion.drops.slice(0,32).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.depth)));
   if(!flat)for(const mark of ctx.camera.marks.filter(m=>m.frame===ctx.camera.frame-1)){
    assert.ok(mark.delta.filter(n=>Math.abs(n)>1e-5).length<=1,'Every daughter remains on one world axis');
    assert.ok(mark.delta.every(n=>Math.abs(n)<=13.00001),'Daughter birth and cell crossing never teleport');
    if(typeof mark.streamId==='string')corners++;
   }
  }
  assert.equal(flow.transitioning,false,'Formation settles into the requested pattern');
  assert.equal(flow.forks.size,0,'Temporary daughters finish; population never accumulates');
 }
 assert.ok(forks>0,'A real second branch is emitted from an existing rain head');
 if(!flat){assert.ok(corners>0);assert.deepEqual(ctx.camera.marks.slice(0,32).map(m=>[m.x,m.y,m.z,m.color]),old,'Birth history remains untouched');}
}
// Audio owns only the live formation, never the user's saved manual choice.
{
 const ctx=setup(),flow=ctx.window.rainAllDirections;flow.setMode('counterflow');
 ctx.window.audioReactiveActive=true;flow.syncAudio();assert.equal(flow.audioOwned,true);
 flow.applyMode('crossflow',true);assert.equal(flow.manualMode,'counterflow');
 ctx.window.audioReactiveActive=false;ctx.window.rainSessionControls={audioPaused:true,stopped:true};flow.syncAudio();
 assert.equal(flow.mode,'crossflow','Emergency Stop preserves formation');
 ctx.window.rainSessionControls={audioPaused:false,stopped:false};flow.syncAudio();assert.equal(flow.mode,'counterflow','Stopping audio restores manual pattern');
 ctx.window.audioReactiveActive=true;flow.setFollowMusic(false);flow.syncAudio();assert.equal(flow.audioOwned,false);
 assert.equal(flow.mode,'counterflow','Manual mode continues while fast audio steering stays active');
}
console.log('PASS bounded mitosis branches, flat/3D/reverse axes, immutable history, natural retirement, manual/audio ownership and emergency pause.');

// A panel-wide click refresh must not undo the checkbox's native toggle before input/change.
{
 const ctx=setup(),flow=ctx.window.rainAllDirections,follow={checked:false},status={textContent:''};
 const buttons=['directed','counterflow','crossflow'].map(mode=>({dataset:{flow:mode},setAttribute(){}}));
 const panel={querySelectorAll:()=>buttons,querySelector:selector=>selector==='#flow-follow-music'?follow:status};
 ctx.document={createElement:()=>panel};flow.mount({append(){}});flow.setFollowMusic(false);
 follow.checked=true;follow.onclick({target:follow});flow.refresh();follow.oninput({target:follow});follow.onchange({target:follow});
 assert.equal(follow.checked,true);assert.equal(flow.followMusic,true,'Follow commits before the ancestor click refresh');
 follow.checked=false;follow.onclick({target:follow});flow.refresh();assert.equal(flow.followMusic,false);
}
console.log('PASS Follow music survives the surrounding settings panel event refresh.');
