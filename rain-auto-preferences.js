// User-selected destinations and dwell times. Native routes still own motion.
(function(){
 'use strict';
 const codec=window.RainSettingsCodec,clone=x=>JSON.parse(JSON.stringify(x));
 const groups={palette:'colors',pattern:'colors',characters:'characters',size:'size',density:'density',pace:'speed',direction:'direction',reverse:'direction',flow:'flow',camera:'camera',depth:'camera','hold viewpoint':'camera','align viewpoint':'camera','prepare flat':'camera',tails:'trails',render:'clarity'};
 const fields={fontSize:'size',density:'density',speed:'speed',intensity:'speed'};
 const state=window.rainAutoPreferences={program:codec.programDefaults(),managesAppearances:true,running:false,held:false,phase:null,elapsed:0,duration:0,due:false};
 try{const saved=localStorage.getItem('matrixRain.autoProgram');if(saved)state.program=codec.validateProgram(JSON.parse(saved));}catch(_){}
 const c=()=>MatrixRainEngine.rainConfig;
 const auto=()=>window.rainAutoScenes;
 const audio=()=>!!(window.audioReactiveActive||window.rainAudioStarting||window.rainSessionControls?.audioPaused);
 state.values=key=>Object.keys(state.program[key].allowed).filter(k=>state.program[key].allowed[k]);
 state.available=key=>state.values(key).filter(value=>key==='camera'?value!=='flat'||!window.rainCloud?.active
  :key==='direction'?rainCamera.enabled||!['toward','away'].includes(value)
  :key==='characters'?value!=='custom'||!!document.getElementById('customCharacters')?.value.trim():true);
 state.keeps=key=>{const value=state.program[key];return typeof value==='boolean'?!value:value?.change===false;};
 state.keepsField=key=>state.keeps(fields[key]);
 state.allows=step=>!state.keeps(groups[step.kind]);
 state.cameraNow=()=>rainCamera.enabled?rainCamera.mode:'flat';
 state.choose=(key,current,available=state.values(key))=>{
  const values=available.filter(v=>v!==current);if(!values.length)return current;
  if(state.program.order==='sequence'){const index=available.indexOf(current);return available[(index+1)%available.length];}
  return values[Math.floor(Math.random()*values.length)];
 };
 state.familyAllowed=family=>{
  if(state.keeps(groups[family]))return false;
  // Camera/depth share one destination list. A lone moving camera is never
  // reset between appearances. Flat entry still uses the existing stopgaps.
  if(family==='depth')return false;
  if(family==='camera'){
   const modes=state.available('camera'),current=state.cameraNow();
   if(!modes.length)return false;
   if(modes.length===1&&modes[0]===current)return false;
   if(modes.every(v=>v==='flat')&&state.keeps('flow')&&window.rainAllDirections.mode!=='directed')return false;
  }
  const key=groups[family];
  if(['flow','characters','direction'].includes(key)){
   const current=key==='flow'?window.rainAllDirections.mode:key==='characters'?c().characterSet:c().direction;
   const values=state.available(key);if(!values.length)return false;
   if(key==='characters'&&values.length===1&&values[0]===document.getElementById('characterSet')?.value)return false;
   if(family!=='reverse'&&values.length===1&&values[0]===current)return false;
   if(family==='reverse'&&values.length<2)return false;
  }
  if(state.keeps('density')&&['camera','size','tails'].includes(family)){
   const budget=auto().loadBudget(),trails=window.matrixRainTrails;
   let work=budget.work,maximum=budget.maximum;
   if(family==='camera')maximum=Math.min(maximum,6000);
   if(family==='size')work*=Math.max(1,state.program.size.max/Math.max(14,c().fontSize))**2;
   if(family==='tails')work*=Math.max(1,64/(trails?.enabled?trails.maximum:40));
   if(work>maximum)return false;
  }
  return true;
 };
 state.families=values=>[...new Set(values)].filter(state.familyAllowed);
 state.requiredFamily=()=>{
  if(!state.keeps('camera')&&!state.values('camera').includes(state.cameraNow())&&state.familyAllowed('camera'))return 'camera';
  if(!state.keeps('flow')&&!state.values('flow').includes(window.rainAllDirections.mode))return 'flow';
  if(!audio()){
   if(!state.keeps('characters')&&!state.values('characters').includes(document.getElementById('characterSet')?.value)&&state.familyAllowed('characters'))return 'characters';
   if(!state.keeps('direction')&&!state.values('direction').includes(c().direction)&&state.familyAllowed('direction'))return 'direction';
  }
  return null;
 };
 state.range=(key,fallback)=>{
  const r=state.program[fields[key]];if(!r||!r.change)return fallback;
  if(key==='speed')return[101-r.max,101-r.min];
  if(key==='intensity')return fallback;
  return[r.min,r.max];
 };
 state.numeric=(current,target,lo,hi)=>Math.max(lo,Math.min(hi,target));
 state.hueTurn=()=>Math.random()<.5?-40:40;
 state.capture=()=>clone(state.program);
 function replan(){
  auto()?.cancelPlan();if(auto()){auto().families.length=0;auto().cloudPass=null;
   auto().tweens=auto().tweens.filter(t=>t.object===c()?!state.keepsField(t.key):t.object===window.matrixRainTrails?!state.keeps('trails'):t.object===window.matrixRainRendering?!state.keeps('clarity'):true);}
 }
 state.applyProgram=(value,save=true)=>{
  const next=codec.validateProgram(value);state.program=next;replan();state.held=false;state.phase=null;state.elapsed=0;state.due=false;
  if(auto())auto().includeCloud=next.appearances.cloud.enabled;
  if(next.appearances.cloud.enabled)window.rainCloud?.prepare?.();
  if(save)try{localStorage.setItem('matrixRain.autoProgram',JSON.stringify(next));}catch(_){}
  window.rainSettingsUI?.refresh();
 };
 state.edit=(path,value)=>{const next=state.capture(),keys=path.split('.'),last=keys.pop();let target=next;for(const key of keys)target=target[key];target[last]=value;
  if(last==='min'&&target.min>target.max)target.max=target.min;
  if(last==='max'&&target.max<target.min)target.min=target.max;
  state.applyProgram(next);};
 state.reset=()=>state.applyProgram(codec.programDefaults());
 state.start=()=>{state.running=true;state.held=false;state.phase=null;state.elapsed=0;state.due=false;replan();};
 state.stop=()=>{state.running=false;state.due=false;};
 state.manual=()=>{state.held=true;state.due=false;auto().cloudPass=null;};
 state.canSchedule=()=>!state.due;
 function dwell(name){const r=state.program.appearances[name];return r.min+Math.random()*(r.max-r.min);}
 state.advance=dt=>{
  if(!state.running||typeof autoOrchestratorActive==='undefined'||!autoOrchestratorActive||window.rainSessionControls?.stopped||state.held)return;
  const cloud=window.rainCloud;if(!cloud||cloud.error)return;
  const a=state.program.appearances,transition=cloud.returning||cloud.gathering||(cloud.active&&cloud.entryAge<cloud.entryDuration);
  // Residence starts on arrival, never during the existing entry/return.
  if(transition){state.phase=null;state.due=false;state.status=cloud.returning?'Returning to rain…':'Moving into cloud…';window.rainAutoUI?.updateStatus();return;}
  const current=cloud.active?'cloud':'rain';
  if(state.phase!==current){state.phase=current;state.elapsed=0;state.duration=dwell(current);}
  else state.elapsed+=Math.max(0,dt);
  const both=a.rain.enabled&&a.cloud.enabled,excluded=!a[current].enabled;
  state.due=excluded||(both&&state.elapsed>=state.duration);
  if(state.due){
   const s=auto(),busy=rainCamera.depthTransition||rainCamera.motionFade||s.tweens.length||s.queue.length||window.rainAllDirections.transitioning;
   state.status='Finishing the current transition…';
   if(!busy){
    if(current==='rain'&&!cloud.engine?.ready){cloud.prepare?.();state.status='Preparing cloud…';}
    else {cloud.choose(current==='rain');state.phase=null;state.elapsed=0;state.due=false;}
   }
  }else state.status=both?(current==='cloud'?'Cloud':'Rain')+' · '+Math.max(0,state.duration-state.elapsed).toFixed(1)+'s until transition':(current==='cloud'?'Cloud':'Rain')+' only';
  window.rainAutoUI?.updateStatus();
 };
 // Load preferences without starting either animation or Auto scenes.
 if(auto())auto().includeCloud=state.program.appearances.cloud.enabled;
})();
