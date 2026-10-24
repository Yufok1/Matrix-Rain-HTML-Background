/* Measured sound supplies energy, chromatic memory and distant illumination. */
(function(root){'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),MODES=['elemental','flux','resonance'];
class AudioDirector{
 constructor(mode='elemental'){
  this.mode=MODES.includes(mode)?mode:'elemental';
  this.sources=new Float32Array(24);this.flow=new Float32Array(24);
  this.waves=new Float32Array(16);this.waveForce=new Float32Array(16);
  this.frontData=new Float32Array(32);this.frontPower=new Float32Array(32);
  this.flashData=new Float32Array(24);this.flashPower=new Float32Array(24);
  this.bands=new Float32Array(48);this.memory=new Float32Array(48);
  this.events=[];this.fronts=[];this.flashes=[];this.lastFront=-10;this.lastFlash=-10;
  this.seen=0;this.count=0;this.ignitions=0;this.flashCount=0;this.lastIgnition=-10;
  this.energy=0;this.slow=0;this.rain=0;this.burst=0;this.active=false;
  this.phase=0;this.power=1;this.positions=[];this.serial=0;this.touch=0;this.manualSeen=0;
  this.sceneProgress=0;this.sceneHue=0;this.interactions=[];this.traceSeen=0;
  this.interactionA=new Float32Array(256);this.interactionB=new Float32Array(256);
 }
 setMode(mode){if(MODES.includes(mode))this.mode=mode;}
 farPoint(point,camera,depth){const scale=depth/Math.max(2,point[2]-camera.eye[2]);return point.map((v,i)=>camera.eye[i]+(v-camera.eye[i])*scale);}
 imprint(from,to,camera,strength=1,depth=null,delay=0){
  const z=depth||Math.max(45,Math.min(270,20+from[2]*6));
  this.interactions.push({from:this.farPoint(from,camera,z),to:this.farPoint(to,camera,z),age:-delay,strength});
  if(this.interactions.length>64)this.interactions.shift();
 }
 flash(point,strength,state,a,manual=false){
  // Local cloud illumination, with a refractory interval during rapid typing.
  if(state.time-this.lastFlash<(manual?.8:2.4))return false;
  const depth=65+(this.flashCount%4)*19,scale=depth/Math.max(4,point[2]);
  const color=a.centroid>.55?[.50,.66,1.]:a.low>a.high*2?[1.,.65,.40]:[.69,.61,1.];
  this.flashes.push({point:[point[0]*scale,point[1]*scale,depth],age:0,strength:clamp(strength,.35,1),color});
  if(this.flashes.length>6)this.flashes.shift();
  this.flashCount++;this.lastFlash=state.time;return true;
 }
 step(dt,envelope,state,camera){
  const a=envelope.value,level=clamp(a.level*this.power,0,1),mode=MODES.indexOf(this.mode);
  this.energy+=(level-this.energy)*(1-Math.exp(-dt/.22));
  this.slow+=(level-this.slow)*(1-Math.exp(-dt/3.8));this.active=this.energy>.014;
  this.phase+=dt*(this.active?.15+a.low*.65+a.mid*.25:.015);
  this.sceneProgress+=dt*(.06+level*.09+a.flux*.025+this.touch*.025);
  const hueTarget=a.centroid*4+a.high*2-a.low*.6+a.pan*.35;
  this.sceneHue+=(hueTarget-this.sceneHue)*(1-Math.exp(-dt/1.1));
  this.burst*=Math.exp(-dt/.17);this.touch*=Math.exp(-dt/1.4);
  this.bands.set(a.bands);
  // Measured bands leave a decaying record. Silence adds nothing.
  for(let i=0;i<48;i++){
   const target=this.active?a.bands[i]:0,tau=target>this.memory[i]?1.3:14;
   this.memory[i]+=(target-this.memory[i])*(1-Math.exp(-dt/tau));
  }
  for(const manual of state.strikes.filter(s=>s.origin!=='audio'&&s.id>this.manualSeen)){
   this.manualSeen=manual.id;
   if(!['press','click','desktop-press'].includes(manual.origin))continue;
   this.touch=Math.max(this.touch,.85);this.touchPoint=manual.target;
   // One concentrated deposit at one depth. Dragging adds connected fuel segments.
   this.imprint(manual.target,manual.target,camera,2.4);
   this.flash(manual.target,.8,state,a,true);
  }
  for(const trace of state.trails.filter(t=>t.id>this.traceSeen)){
   this.traceSeen=trace.id;
   if(trace.gain>1)this.imprint(trace.from,trace.to,camera,1.15);
  }
  const bases=[[.22,.56],[.77,.42],[.38,.25],[.65,.74],[.15,.30],[.85,.68]];
  for(let i=0;i<6;i++){
   let energy=0,weighted=0,total=0;
   for(let j=0;j<8;j++){let value=a.bands[i*8+j];energy+=value*value;weighted+=value*j;total+=value;}
   energy=Math.sqrt(energy/8);const centroid=weighted/Math.max(.001,total*7);
   const x=clamp(bases[i][0]+a.pan*.16+(centroid-.4)*.06,.07,.93),y=clamp(bases[i][1]+(a.centroid-.5)*.14+(energy-.3)*.11,.09,.91);
   const point=camera.atDepth(x*camera.width,y*camera.height,7+i*4.6+a.width*2);
   if(!this.positions[i])this.positions[i]=point;
   const p=this.positions[i];for(let k=0;k<3;k++)p[k]+=(point[k]-p[k])*(1-Math.exp(-dt*1.5));
   const power=this.active?clamp(Math.sqrt(energy)*.75+level*.12,0,1):0;
   this.sources.set([...p,power],i*4);
   const angle=i*2.399+a.centroid*1.5+a.pan*.7;
   this.flow.set([Math.cos(angle),.35+energy*.8,Math.sin(angle),2+level*2.2],i*4);
  }
  if(mode>0&&this.touchPoint&&this.touch>.01)this.sources.set([...this.touchPoint,Math.max(this.sources[3],this.touch*.8)],0);
  if(envelope.onsets!==this.seen){
   this.seen=envelope.onsets;
   if(this.active){
    const index=this.count%6,point=this.positions[index],strength=clamp(.25+a.transient+a.low*.6,.2,1.6);
    this.events.push({point:[...point],age:0,strength,axis:[a.pan*.6,.6+a.mid*.4,.4+a.high]});
    if(this.events.length>4)this.events.shift();this.count++;this.serial++;this.burst=strength;
    // Music can start a cold volume; it cannot continually repaint burning or wet space.
    if(mode===0&&state.time-this.lastIgnition>.45){state.strike(point,'audio');this.ignitions++;this.lastIgnition=state.time;}
    if(a.transient>.18)this.flash(point,strength*.7,state,a);
    if(state.time-this.lastFront>.6){
     const scale=2+index*.65;this.fronts.push({point:point.map(v=>v*scale),age:0,strength});
     if(this.fronts.length>8)this.fronts.shift();this.lastFront=state.time;
    }
   }
  }
  state.audioActive=mode===0&&this.active;state.audioEnergy=level;
  const target=this.active?clamp((this.slow-this.energy-.04)*2.8+a.high*a.flux*.22,0,.65):0;
  this.rain+=(target-this.rain)*(1-Math.exp(-dt/(target>this.rain?.45:1.5)));state.audioRain=0;
  this.waves.fill(0);this.waveForce.fill(0);
  for(let i=this.events.length-1;i>=0;i--){this.events[i].age+=dt;if(this.events[i].age>2.3)this.events.splice(i,1);}
  this.events.forEach((e,i)=>{this.waves.set([...e.point,e.age],i*4);this.waveForce.set([...e.axis,e.strength*Math.exp(-e.age*1.3)],i*4);});
  this.frontData.fill(0);this.frontPower.fill(0);
  for(let i=this.fronts.length-1;i>=0;i--){this.fronts[i].age+=dt;if(this.fronts[i].age>12)this.fronts.splice(i,1);}
  this.fronts.forEach((f,i)=>{this.frontData.set([...f.point,f.age],i*4);this.frontPower.set([f.strength*Math.exp(-f.age*.12),0,0,0],i*4);});
  this.flashData.fill(0);this.flashPower.fill(0);
  for(let i=this.flashes.length-1;i>=0;i--){this.flashes[i].age+=dt;if(this.flashes[i].age>6)this.flashes.splice(i,1);}
  this.flashes.forEach((f,i)=>{this.flashData.set([...f.point,f.age],i*4);this.flashPower.set([...f.color,f.strength],i*4);});
  this.interactionA.fill(0);this.interactionB.fill(0);
  for(let i=this.interactions.length-1;i>=0;i--){this.interactions[i].age+=dt;if(this.interactions[i].age>6)this.interactions.splice(i,1);}
  this.interactions.forEach((p,i)=>{this.interactionA.set([...p.from,p.age],i*4);this.interactionB.set([...p.to,p.strength],i*4);});
  this.values={audioDrive:[a.low,a.mid,a.high,Math.max(level,this.touch*.7)],audioSpatial:[a.pan,a.centroid,a.flux,a.width],musicSources:this.sources,musicFlow:this.flow,musicWaves:this.waves,musicWaveForce:this.waveForce,musicControl:[mode,Math.max(this.burst,this.touch*.5),this.phase,Math.max(this.active?1:0,this.touch)],sceneControl:[this.sceneProgress,this.phase,this.sceneHue,Math.max(.25,this.energy)],interactionA:this.interactionA,interactionB:this.interactionB,cycleControl:[['ready','burning','deluge','clearing'].indexOf(state.phase),state.extent,state.rain,state.phaseTime],cycleOrigin:[...state.cycleOrigin,0],musicBands:this.bands,musicMemory:this.memory,cosmicFront:this.frontData,cosmicPower:this.frontPower,heatFlashes:this.flashData,heatFlashPower:this.flashPower};
  return this.values;
 }
}
const api={AudioDirector,MODES};if(typeof module!=='undefined')module.exports=api;else root.ElementalShow=api;
})(typeof window!=='undefined'?window:globalThis);
