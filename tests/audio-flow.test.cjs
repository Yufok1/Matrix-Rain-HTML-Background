const assert=require('node:assert/strict');
const load=require('./load-runtime.cjs'),Motion=load('beat-turns-policy.js'),Flow=load('rain-audio-flow.js');
function direct({seconds=8,seed='directed',signal}={}){
 const f=new Flow();f.reset(seed);const samples=[];
 for(let i=0;i<seconds*120;i++){
  const t=i*1000/120,v=signal(t),a={bandFast:Float32Array.from(v.bands||Array(6).fill(v.fast)),bandSlow:Float32Array.from(v.slowBands||Array(6).fill(v.slow)),fastEnergy:v.fast,slowEnergy:v.slow};
  const m={impulse:v.impulse||0,accent:!!v.accent,flux:v.flux||0};
  const before=JSON.stringify(a),out=f.update(a,m,t);assert.equal(JSON.stringify(a),before);samples.push({t,...out});
 }
 return {f,samples};
}
for(const seed of ['directed','counterflow','crossflow']){
 const r=direct({seed,signal:()=>({fast:.3,slow:.3})});
 assert.equal(r.f.trace.length,0,'An unchanging sound cannot invent formation changes');
 assert.equal(r.f.expansion,['directed','counterflow','crossflow'].indexOf(seed));
}
const isolated=direct({signal:t=>({fast:t>=1000&&t<1100?.9:.15,slow:.15,impulse:t>=1000&&t<1100?.8:0,accent:t>=1000&&t<1009})});
assert.ok(isolated.f.trace.some(v=>v.to==='counterflow'),'An isolated clear accent can open the paired current');
assert.ok(!isolated.f.trace.some(v=>v.to==='crossflow'),'One short hit cannot fire the entire bloom');
assert.equal(isolated.f.snapshot.mode,'directed','The isolated gesture relaxes afterwards');
const buildSignal=t=>{
 if(t<700)return {fast:.12,slow:.12};
 if(t>3500)return {fast:.07,slow:.25};
 const age=t-700,pulse=age%400<125;
 const fast=.18+Math.min(age/2400,1)*.52+(pulse?.22:0);
 return {fast,slow:.2,impulse:pulse?.8:0,accent:age%400<9,flux:pulse?.03:0};
};
const r=direct({signal:buildSignal});
assert.ok(r.f.trace.some(v=>v.to==='counterflow')&&r.f.trace.some(v=>v.to==='crossflow'),'Developing musical support reaches both bloom stages');
assert.ok(r.f.trace[0].time<1250,'A clear buildup begins opening within half a second');
assert.equal(r.f.snapshot.mode,'directed','Falling support relaxes into a true Single');
assert.ok(r.f.trace.length<12,'One buildup is a coherent gesture, not dozens of threshold flips');
for(let i=0;i<r.f.trace.length;i++){
 const step=r.f.trace[i];assert.equal(Math.abs(['directed','counterflow','crossflow'].indexOf(step.to)-['directed','counterflow','crossflow'].indexOf(step.from)),1,'Audible development progresses through adjacent bloom stages');
 if(i)assert.ok(step.time-r.f.trace[i-1].time>=250,'A formation has time to become readable');
}
const jitter=direct({signal:t=>({fast:.3+.002*Math.sin(t/70),slow:.3})});
assert.equal(jitter.f.trace.length,0,'Small fluctuations cannot reshuffle the formation');
const fade=direct({seed:'crossflow',signal:t=>t<500?{fast:.3,slow:.3}:{fast:0,slow:.3}});
assert.equal(fade.f.snapshot.mode,'directed');assert.equal(fade.f.expansion,0,'Silence cannot pump the pattern');
assert.deepEqual(direct({signal:buildSignal}).samples,direct({signal:buildSignal}).samples,'The same musical development reproduces the same bloom');
// Exercise the real accepted analyser too; observing it must leave all fast
// headings, propulsion and colors' inputs exactly as before.
for(const beatTurns of [false,true]){
 const a=new Motion(),b=new Motion(),f=new Flow();let h='down',baseline='down';
 for(let i=0;i<3600;i++){
  const t=i*1000/60,arrangement=i<1200?.3:i<2400?1.6:.2;
  const s=Float32Array.from({length:64},(_,k)=>i>=3000?0:.002+arrangement*(t%((k%3+1)*173)<73?.2:.01));
  const m=a.update(s,t,h,true,beatTurns),ref=b.update(s,t,baseline,true,beatTurns);
  f.update(a,m,t);assert.deepEqual(m,ref);h=m.direction;baseline=ref.direction;
 }
 assert.ok(f.trace.some(v=>v.to==='counterflow')&&f.trace.some(v=>v.to==='directed'),'Actual audio analysis opens and relaxes with arrangement changes');
}
console.log('PASS staged musical bloom / release, isolated-hit restraint, no threshold chatter or clock-driven cycles, silence, determinism and exact accepted fast steering / propulsion parity.');
