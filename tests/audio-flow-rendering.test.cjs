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
 // These integration scenarios explicitly opt into the optional feature.
 ctx.window.rainAllDirections.setFollowMusic(true);
 return ctx;
}
function audioFrame(ctx,mode,expansion,now=0){
 const flow=ctx.window.rainAllDirections;
 // Exercise the same controller-to-renderer boundary as live music. Assigning
 // expansion alone misses disagreements between the highlighted mode and heads.
 flow.conductor.update=()=>({mode,expansion});
 flow.updateAudio({}, {},now);
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

// Continuous live pressure reaches actual heads without restarting the field.
for(const flat of [false,true])for(const reverse of [1,-1]){
 const ctx=setup(),flow=ctx.window.rainAllDirections;ctx.camera.enabled=!flat;ctx.reverseFlowMultiplier=reverse;ctx.tick();
 ctx.window.audioReactiveActive=true;flow.syncAudio();
 const old=ctx.camera.marks.map(m=>[m.x,m.y,m.z,m.color]);let forkCount=0,swaps=0,last=new Map();
 for(let frame=0;frame<240;frame++){
  const pressure=frame<20?0:frame<80?2:frame<120?.55:frame<150?1.8:0;
  audioFrame(ctx,pressure>1.5?'crossflow':pressure>.59?'counterflow':'directed',pressure,frame*16.67);
  ctx.tick(.85);forkCount=Math.max(forkCount,flow.forks.size);
  const active=ctx.window.activeColumnsMask?.filter(Boolean).length??ctx.motion.drops.length;
  assert.ok(flow.forks.size<=Math.max(1,Math.floor(active*.12)),'Audio accents never add more than twelve percent temporary heads');
  for(let i=0;i<32;i++){
   const dir=ctx.motion.drops[i].lastStepDirection;
   if(last.has(i)&&last.get(i)!==dir)swaps++;last.set(i,dir);
  }
  if(!flat)for(const mark of ctx.camera.marks.filter(m=>m.frame===ctx.camera.frame-1)){
   assert.ok(mark.delta.filter(n=>Math.abs(n)>1e-5).length<=1,'Pressure cannot create diagonal movement');
   assert.ok(mark.delta.every(n=>Math.abs(n)<=(frame===0?10.00001:8.50001)),'Live split and gathering cannot teleport '+JSON.stringify({frame,mark}));
  }
 }
 assert.ok(forkCount>0&&swaps>20,'Partial live pressure actually steers and branches heads');
 assert.equal(flow.forks.size,0,'Rapid reversible splits do not grow permanent density');
 assert.ok(ctx.motion.drops.slice(0,32).every(p=>p.lastStepDirection==='down'),'A full release actually gathers into Single');
 if(!flat)assert.deepEqual(ctx.camera.marks.slice(0,32).map(m=>[m.x,m.y,m.z,m.color]),old,'Old trail birth colors and coordinates remain immutable');
}
console.log('PASS continuous audio pressure physically opens and regathers bounded, axis-aligned live heads without changing their trail history.');

// Single must be geometrically single, including nonzero subthreshold pressure
// and after an actual split. The old renderer kept opposing cohorts here.
for(const flat of [false,true])for(const reverse of [1,-1]){
 const ctx=setup(),flow=ctx.window.rainAllDirections;ctx.camera.enabled=!flat;ctx.reverseFlowMultiplier=reverse;ctx.tick();
 ctx.window.audioReactiveActive=true;flow.syncAudio();
 const old=ctx.camera.marks.map(m=>[m.x,m.y,m.z,m.color]);
 for(const heading of (flat?['down','left','up','right']:Object.keys(vectors))){
  ctx.MatrixRainEngine.rainConfig.direction=heading;
  for(const pressure of [.17,.39,.58])for(const accent of ['counterflow','crossflow']){
   for(let n=0;n<12;n++){audioFrame(ctx,accent,accent==='crossflow'?2:1);ctx.tick();}
   assert.ok(new Set(ctx.motion.drops.slice(0,32).map(p=>p.lastStepDirection)).size>=2,'Accent really opens opposing currents before release');
   audioFrame(ctx,'directed',pressure);ctx.tick();
   assert.equal(flow.mode,'directed');assert.equal(flow.liveExpansion,false);assert.equal(flow.independentTurns,false);
   assert.equal(flow.records.size,0,'Single retires per-head route memory');assert.equal(flow.forks.size,0,'Single has no daughter heads');
   for(let n=0;n<4;n++){
    // Fast shared steering remains free to dance while the formation is Single.
    const shared=(flat?['down','left','up','right']:Object.keys(vectors))[n];
    ctx.MatrixRainEngine.rainConfig.direction=shared;audioFrame(ctx,'directed',pressure);ctx.tick(.85);
    for(let i=0;i<32;i++){
     assert.equal(flow.directionFor(i,!flat),null,'Single delegates to original shared heading');
     assert.equal(ctx.motion.drops[i].lastStepDirection,shared,'Highlighted Single means every real head shares its direction');
    }
   }
  }
 }
 if(!flat)assert.deepEqual(ctx.camera.marks.slice(0,32).map(m=>[m.x,m.y,m.z,m.color]),old,'Gathering never edits the previously drawn trail');
}
console.log('PASS actual Single heads agree with the mode at partial pressure, after both accents, in every heading, flat/3D and reverse flow.');

// Beats can breathe inside a formation without continuously reassigning axes.
for(const flat of [false,true])for(const mode of ['counterflow','crossflow']){
 const ctx=setup(),flow=ctx.window.rainAllDirections;ctx.camera.enabled=!flat;ctx.tick();
 ctx.window.audioReactiveActive=true;flow.syncAudio();
 for(let n=0;n<16;n++){audioFrame(ctx,mode,1);ctx.tick();}
 const settled=ctx.motion.drops.slice(0,32).map(p=>p.lastStepDirection);
 assert.equal(new Set(settled).size,mode==='counterflow'?2:flat?4:6,'The actual settled formation has the correct headings');
 for(let n=0;n<100;n++){
  audioFrame(ctx,mode,n%2?.05:1.95);ctx.tick();
  assert.deepEqual(ctx.motion.drops.slice(0,32).map(p=>p.lastStepDirection),settled,'Intra-formation fluctuations cannot reshuffle the actual heads');
 }
 assert.equal(flow.forks.size,0,'A held formation cannot keep generating phantom branches');
}
console.log('PASS coherent Counterflow / Crossflow cohorts remain stable through continuous envelope fluctuations.');

// Replay real audio envelopes through the unmodified conductor AND renderer.
// The private fixture is optional and is never distributed with the wallpaper.
for(const fixture of ['tests/real-music-features.private.json','tests/second-track-features.private.json'])if(fs.existsSync(fixture)){
 const ctx=setup(),flow=ctx.window.rainAllDirections;ctx.window.audioReactiveActive=true;flow.syncAudio();
 let singleFrames=0,accentFrames=0;
 for(const [t,f,s,p,fast,slow,m] of JSON.parse(fs.readFileSync(fixture,'utf8'))){
  ctx.MatrixRainEngine.rainConfig.direction=m.direction||'down';
  flow.updateAudio({fastEnergy:f,slowEnergy:s,energyPeak:p,bandFast:fast,bandSlow:slow},m,t);ctx.tick(.85);
  if(flow.mode==='directed'){
   singleFrames++;
   assert.equal(new Set(ctx.motion.drops.slice(0,32).map(p=>p.lastStepDirection)).size,1,'Real-song Single must actually have one shared heading');
   assert.ok(ctx.motion.drops.slice(0,32).every(p=>p.lastStepDirection===ctx.MatrixRainEngine.rainConfig.direction),'Single follows the actual recorded fast steering');
   assert.equal(flow.forks.size,0,'No stale daughter heads during real-song Single');
  }else accentFrames++;
 }
 assert.ok(singleFrames>0&&accentFrames>0);
 assert.ok(singleFrames>accentFrames*2,'Single stays physically dominant on recorded music');
 console.log(`PASS real-song renderer: ${singleFrames} physically Single frames and ${accentFrames} accent frames.`);
}

for(const manual of ['counterflow','crossflow']){
 const ctx=setup(),flow=ctx.window.rainAllDirections;flow.setMode(manual);
 ctx.window.audioReactiveActive=true;flow.syncAudio();
 assert.equal(flow.mode,'directed','Enabling Follow music starts in Single');
 assert.equal(flow.manualMode,manual,'The manual choice is retained');
 flow.setFollowMusic(false);
 assert.equal(flow.mode,manual,'The saved manual pattern returns when Follow music stops');
}
