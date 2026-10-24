// Scheduler/policy tests. The cloud lifecycle here is deterministic; actual
// head adoption, native fades and reverse paths live in cloud-advection.test.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=file=>fs.readFileSync(file,'utf8'),html=read('matrix-rain-utility-suite.html');
function fixture(audio=false,saved=null){
 let time=0,seed=9724,serial=0;const timers=new Map(),storage=new Map(),elements=new Map(),calls=[],steps=[];
 if(saved!==null)storage.set('matrixRain.autoSceneCloud',saved);
 const element=id=>{if(!elements.has(id))elements.set(id,{value:id==='characterSet'?'katakana':'',checked:false,style:{},dataset:{},classList:{add(){},remove(){}},textContent:''});return elements.get(id);};
 const config={direction:'down',speed:35,intensity:70,density:32,fontSize:16,pattern:'classic',characterSet:'katakana',primaryColor:'#00ff41',secondaryColor:'#00cc33'};
 const camera={enabled:true,continuous:true,perspective:1,mode:'fixed',motionGain:1,speeds:{},yaw:0,pitch:0,roll:0,bounds:{pad:25.6},
  beginContinuousView(){},refreshControls(){},syncTrailSettings(){},wrap(x){return x;},
  setMode(value){this.mode=value;},settleMotion(){this.motionFade={left:.5};},resumeMotion(value){this.mode=value;this.motionFade={left:.5};},
  transitionDepth(value){this.enabled=value;this.depthTransition={left:1,target:value?1:0};}};
 const cloud={active:false,returning:false,gathering:false,entryAge:0,entryDuration:2,engine:{ready:true},
  choose(on){calls.push({on,time,age:this.entryAge,direction:config.direction,flow:window.rainAllDirections.mode,depthTransition:!!camera.depthTransition,tweens:scenes.tweens.length});
   if(on){this.active=true;this.returning=false;this.gathering=true;this.entryAge=0;}
   else{this.returning=true;this.returnAge=0;this.returnDuration=Math.max(.05,Math.min(2,this.entryAge));}}};
 const window={rainCloud:cloud,audioReactiveActive:audio,rainSessionControls:{stopped:false},
  RainCameraMotion:{safePlanarAngles:(yaw,pitch,roll)=>({yaw,pitch,roll})},
  rainAllDirections:{mode:'directed',enabled:false,transitioning:false,forks:new Map(),applyMode(mode){this.mode=mode;this.enabled=mode!=='directed';}},
  matrixRainRendering:{sharp:true,smooth:true,glow:0,contrast:1},
  matrixRainTrails:{enabled:false,minimum:40,maximum:40,stepped:true,configure(min,max){this.minimum=min;this.maximum=max;}}};
 const context=vm.createContext({window,document:{getElementById:element,querySelector:()=>element('pattern'),querySelectorAll:()=>[]},
  localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},
  Math:Object.assign(Object.create(Math),{random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}}),
  rainCamera:camera,rainCameraGPU:{invalidate:false},rainMotion:{drops:[]},matrixCanvas:{width:960},MatrixRainEngine:{rainConfig:config},
  recomputeActiveColumnsMask(){},autoOrchestratorActive:false,autoOrchestratorInterval:null,reverseFlowMultiplier:1,console,
  setTimeout(callback,delay){const id=++serial;timers.set(id,{callback,at:time+delay/1000});return id;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(read('rain-auto-scenes.js'),context);const scenes=window.rainAutoScenes;
 for(const name of ['orchestrateRandomChange','scheduleNextChange','startAutoOrchestrator','stopAutoOrchestrator']){
  const source=html.match(new RegExp('^        function '+name+'\\([^\\n]*\\) \\{[\\s\\S]*?^        \\}','gm'))?.at(-1);assert.ok(source,name);vm.runInContext(source,context);
 }
 const apply=scenes.apply;scenes.apply=function(step){const result=apply.call(this,step);if(result)steps.push({kind:step.kind,time,cloud:cloud.active,returning:cloud.returning});return result;};
 const music=()=>JSON.stringify([config.direction,config.speed,config.intensity,config.primaryColor,config.secondaryColor,config.pattern,config.characterSet,context.reverseFlowMultiplier]);
 const advance=seconds=>{const end=time+seconds;while(time+1e-9<end){const dt=Math.min(1/30,end-time);time+=dt;
  const output=music();
  for(const [id,timer]of [...timers])if(timer.at<=time+1e-9){timers.delete(id);timer.callback();}
  for(const key of ['depthTransition','motionFade'])if(camera[key]){camera[key].left-=dt;if(camera[key].left<=0){if(key==='depthTransition')camera.perspective=camera[key].target;camera[key]=null;}}
  scenes.advance(dt);
  if(cloud.active){if(cloud.returning){cloud.returnAge+=dt;if(cloud.returnAge>=cloud.returnDuration){cloud.active=false;cloud.returning=false;}}
   else{cloud.entryAge+=dt;cloud.gathering=false;}}
  if(audio)assert.equal(music(),output,'Auto leaves current audio direction, speed, intensity, palette and characters alone');
 }};
 const start=interval=>{scenes.setInterval(interval,false);context.autoOrchestratorActive=true;context.startAutoOrchestrator();};
 return{scenes,cloud,camera,config,window,context,storage,calls,steps,advance,start,time:()=>time};
}

module.exports=fixture;
if(require.main===module){
// Fresh installations and Reset stay rain-only; only an explicit saved opt-in
// re-enables cloud. The ordinary scheduler still makes its usual variations.
{
 const h=fixture();assert.equal(h.scenes.includeCloud,false);h.start(.1);h.advance(600);
 assert.equal(h.calls.length,0);assert.ok(h.steps.length>25);
 h.scenes.setIncludeCloud(true);assert.equal(h.storage.get('matrixRain.autoSceneCloud'),'1');
 h.scenes.setIncludeCloud(false);assert.equal(h.storage.get('matrixRain.autoSceneCloud'),'0');
 assert.equal(fixture(false,'1').scenes.includeCloud,true);
 assert.equal(fixture(false,'0').scenes.includeCloud,false);
}

// A passage is tied to the existing direction choice, not an independent
// timer or playlist. Capture happens before the native heading changes.
{
 const h=fixture();h.scenes.setIncludeCloud(true);h.scenes.setInterval(1,false);
 h.scenes.apply({kind:'direction',value:'right'});
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].direction,'down');assert.equal(h.config.direction,'right');
 h.advance(7.2);assert.equal(h.cloud.active,false);assert.equal(h.calls.length,2);
 assert.ok(h.calls[1].age>=5&&h.calls[1].age<5.1,'Cloud itself lasts five seconds before returning');
 h.advance(100);assert.equal(h.calls.length,2,'No autonomous rain/cloud residence cycle');
}
// The existing slider scales the passage; native reversal is never sped up.
const ages=[];
for(const interval of [.1,12,60]){
 const h=fixture();h.scenes.setIncludeCloud(true);h.scenes.setInterval(interval,false);
 h.scenes.apply({kind:'direction',value:'right'});h.advance(Math.max(8,interval*.5+4));
 const exit=h.calls.find(c=>!c.on);assert.ok(exit);ages.push(exit.age);
 assert.ok(exit.age>=Math.max(5,interval*.34)-1e-6);
 assert.ok(exit.age<=Math.max(5,interval*.46)+1/30+1e-6);
 assert.equal(h.cloud.active,false,'Passage finishes without waiting for another scene tick');
}
assert.ok(ages.every((age,i)=>i===0||age>=ages[i-1]));
assert.ok(ages.at(-1)>ages[0],'Long intervals extend beyond the five-second cloud minimum');
// Existing multi-step direction routes continue underneath, and non-direction
// steps wait for the same heads to return. Queues are never discarded by cloud.
{
 const h=fixture();h.scenes.setIncludeCloud(true);h.scenes.setInterval(1,false);
 h.scenes.queue.push({kind:'direction',value:'right'},{kind:'direction',value:'up'},{kind:'size'});
 assert.equal(h.scenes.next(),true);h.advance(.1);assert.equal(h.scenes.next(),true);
 assert.equal(h.config.direction,'up');assert.equal(h.calls.filter(c=>c.on).length,1);
 assert.equal(h.scenes.next(),false);assert.equal(h.scenes.queue[0].kind,'size');
 h.advance(7.2);assert.equal(h.scenes.next(),true);assert.equal(h.scenes.queue.length,0);
}
// Real Auto scheduler makes progress at fast and slow settings, including audio
// spatial ownership. Flow changes get cloud without stealing audio beat turns.
for(const audio of [false,true])for(const interval of [.1,12,60]){
 const h=fixture(audio);h.scenes.setIncludeCloud(true);h.start(interval);h.advance(interval===60?2000:500);
 const entries=h.calls.filter(c=>c.on),exits=h.calls.filter(c=>!c.on);
 assert.ok(entries.length>=2&&exits.length>=1,`Passages progress at ${interval}s/audio=${audio}`);
 assert.ok(h.steps.some(s=>s.cloud&&['direction','reverse','flow'].includes(s.kind)));
 assert.ok(h.steps.some(s=>!s.cloud&&['depth','size','density','camera'].includes(s.kind)),'Other Auto families continue');
 assert.ok(entries.every(c=>!c.depthTransition&&c.tweens===0));
 assert.ok(exits.every(c=>c.age<Math.max(5,interval*.46)+1/30+.01));
}
// Turning the option off finishes Auto's normal return, even if Auto stops.
// A new slider setting also changes an in-flight passage's deadline.
{
 const h=fixture();h.scenes.setIncludeCloud(true);h.scenes.setInterval(60,false);
 h.scenes.apply({kind:'direction',value:'right'});h.advance(5.5);
 h.scenes.setInterval(1,false);h.advance(.1);assert.equal(h.cloud.returning,true);
 h.advance(3);assert.equal(h.cloud.active,false);
 h.scenes.apply({kind:'direction',value:'up'});h.advance(.1);
 h.scenes.setIncludeCloud(false);assert.equal(h.cloud.returning,true);
 h.advance(1);assert.equal(h.cloud.active,false);
}
// Manual cloud has no automatic deadline. Returning is protected from new
// scene changes, and renderer readiness cannot block the normal rain engine.
{
 const h=fixture();h.cloud.choose(true);h.scenes.manualCloudChoice();h.scenes.setIncludeCloud(true);
 h.start(.1);h.advance(100);assert.equal(h.cloud.active,true);assert.equal(h.calls.filter(c=>!c.on).length,0);
 assert.ok(h.steps.length>8,'Auto continues compatible changes during a manually held cloud');
 h.context.autoOrchestratorActive=false;h.context.stopAutoOrchestrator();h.advance(5);
 h.scenes.setIncludeCloud(false);h.advance(10);assert.equal(h.cloud.active,true);
 h.cloud.choose(false);const before=JSON.stringify(h.config);
 assert.equal(h.scenes.apply({kind:'direction',value:'right'}),false);h.advance(1);assert.equal(JSON.stringify(h.config),before);
 h.advance(2);h.cloud.engine.ready=false;h.scenes.setIncludeCloud(true);
 assert.equal(h.scenes.apply({kind:'direction',value:'right'}),true);assert.equal(h.cloud.active,false);
}
console.log('PASS: default-off opt-in, direction capture order, interval-scaled varied passages, native return timing, retained routes, real 0.1/12/60s Auto scheduler, audio ownership, manual independence and opt-out.');
}
