const assert=require('node:assert/strict');
const load=require('./load-runtime.cjs'),Motion=load('beat-turns-policy.js'),Flow=load('rain-audio-flow.js');
function direct({seconds=8,seed='directed',fps=120,signal}={}){
 const f=new Flow();f.reset(seed);const samples=[];
 for(let i=0;i<seconds*fps;i++){
  const t=i*1000/fps,v=signal(t),a={bandFast:Float32Array.from(v.bands||Array(6).fill(v.fast)),bandSlow:Float32Array.from(v.slowBands||Array(6).fill(v.slow)),fastEnergy:v.fast,slowEnergy:v.slow};
  const m={impulse:v.impulse||0,accent:!!v.accent,flux:v.flux||0};
  const before=JSON.stringify([a,m]),out=f.update(a,m,t);assert.equal(JSON.stringify([a,m]),before);samples.push({t,...out});
 }
 return {f,samples};
}
function bounded(result,fps=120){
 let entered=null,deadline=null,previous='directed',singleSince=0,lastDuration=0,accentFrames=0,crossFrames=0;
 const step=1000/fps;
 for(const s of result.samples){
  if(s.mode!=='directed'){accentFrames++;if(s.mode==='crossflow')crossFrames++;}
  if(previous==='directed'&&s.mode!=='directed'){
   if(lastDuration)assert.ok(s.t-singleSince+1e-6>=Math.max(750,lastDuration*2.2),'Single gets breathing room before another event');
   entered=s.t;deadline=s.deadline;assert.ok(s.onset,'Every new accent starts on an observed audio event');
  }
  if(entered!==null&&s.mode!=='directed'){
   assert.equal(s.deadline,deadline,'More hits and loudness cannot extend an accent');
   assert.ok(s.t-entered<=980+step,'No indefinite accent');
  }
  if(previous!=='directed'&&s.mode==='directed'){
   lastDuration=s.t-entered;singleSince=s.t;entered=null;
   assert.ok(lastDuration<=980+step+1e-6,'Accent expires while audio continues');
  }
  previous=s.mode;
 }
 assert.ok(accentFrames/result.samples.length<.34,'Single remains the majority even under dense input');
 assert.ok(crossFrames/result.samples.length<.14,'Crossflow remains a rare accent');
}
for(const seed of ['directed','counterflow','crossflow']){
 const r=direct({seed,signal:()=>({fast:.3,slow:.3})});
 assert.equal(r.f.trace.length,0,'Unchanging audio cannot invent an event');
 assert.ok(r.samples.every(s=>s.mode==='directed'),'Automatic listening starts in Single regardless of saved manual pattern');
}
const isolated=direct({signal:t=>({fast:t>=1000&&t<1100?.9:.15,slow:.15,impulse:t>=1000&&t<1100?.8:0,accent:t>=1000&&t<1009,flux:t>=1000&&t<1009?.08:0})});
assert.ok(isolated.f.trace.some(v=>v.to==='counterflow'),'One clear hit makes a readable accent');
assert.ok(!isolated.f.trace.some(v=>v.to==='crossflow'),'An isolated hit is not automatically a full-field accent');
assert.equal(isolated.f.snapshot.mode,'directed');bounded(isolated);
// A loud plateau after an attack used to latch Counterflow until a breakdown.
const plateau=direct({seconds:30,signal:t=>({fast:t<1000?.1:.85,slow:.1,accent:t>=1000&&t<1009,flux:t>=1000&&t<1009?.1:0})});
assert.equal(plateau.f.trace.filter(v=>v.to!=='directed').length,1,'Sustained loudness never renews a gesture');bounded(plateau);
assert.equal(plateau.f.snapshot.mode,'directed');
const dense=t=>({fast:.55+.2*Math.sin(t/100),slow:.3,accent:t%200<10,flux:.08,impulse:1,bands:Array.from({length:6},(_,i)=>.3+.3*Math.sin(t/(90+i*17))**2)});
for(const fps of [30,60,120])for(const seed of ['directed','counterflow','crossflow']){
 const r=direct({seconds:120,seed,fps,signal:dense});bounded(r,fps);
 assert.ok(r.f.trace.length>=2,'The initial real attack can still make an accent');
}
// Ordinary recurring attacks establish context; a new stronger, wider arrival
// can earn Crossflow. It then returns to Single with no quiet section needed.
const standout=t=>{
 const burst=t>=10000&&t<10100,regular=t<5000&&t%500<40;
 return {fast:burst?.95:regular?.34:.22,slow:.22,accent:burst?t<10009:regular&&t%500<9,
  flux:burst?.24:regular?.025:0,bands:burst?[.95,.3,.9,.35,.85,.4]:Array(6).fill(regular?.34:.22)};
};
const big=direct({seconds:20,signal:standout});
assert.ok(big.f.trace.some(v=>v.to==='counterflow'),'Ordinary accents remain available');
assert.ok(big.f.trace.some(v=>v.to==='crossflow'),'A standout musical arrival can select Crossflow');bounded(big);
assert.deepEqual(direct({seconds:20,signal:standout}).samples,big.samples,'Identical input produces identical choreography');
const identical=direct({seconds:40,signal:t=>({fast:t%500<40?.4:.2,slow:.2,accent:t%500<9,flux:t%500<40?.04:0})});
assert.ok(!identical.f.trace.some(v=>v.to==='crossflow'),'Equal repeating drum hits cannot all claim to be exceptional');bounded(identical);
const jitter=direct({signal:t=>({fast:.3+.002*Math.sin(t/70),slow:.3})});
assert.equal(jitter.f.trace.length,0,'Small level fluctuations do not reshuffle patterns');
const stopped=direct({signal:t=>t<1300?{fast:t<1000?.2:.9,slow:.2,accent:t>=1000&&t<1009,flux:t>=1000&&t<1009?.1:0}:{fast:0,slow:.2}});
assert.equal(stopped.f.snapshot.mode,'directed');assert.equal(stopped.f.expansion,0);
for(const jump of [1500,-400]){
 const f=new Flow(),quiet={fastEnergy:.2,bandFast:Array(6).fill(.2)},loud={fastEnergy:.9,bandFast:Array(6).fill(.9)};
 f.update(quiet,{},0);assert.equal(f.update(loud,{accent:true,flux:.2},100).mode,'counterflow');
 assert.equal(f.update(loud,{},jump).mode,'directed','A callback gap or clock rewind cannot strand a pattern');
 for(let t=jump+50;t<jump+2500;t+=50)assert.equal(f.update(loud,{},t).mode,'directed','Resuming a held sound cannot queue an accent');
 assert.equal(f.update(loud,{accent:true,flux:.2},jump+2500).mode,'counterflow','New evidence can trigger again after recovery');
}
// The same observed stream at different frame rates stays responsive and finite.
for(const fps of [30,60,120]){
 const r=direct({seconds:20,fps,signal:standout});bounded(r,fps);
 assert.ok(r.f.trace.some(v=>v.to==='crossflow'));
}
// Observe paired copies of the real accepted analyser, checking every output.
for(const beatTurns of [false,true]){
 const a=new Motion(),b=new Motion(),f=new Flow();let h='down',baseline='down';
 for(let i=0;i<3600;i++){
  const t=i*1000/60,arrangement=i<1200?.3:i<2400?1.6:.2;
  const s=Float32Array.from({length:64},(_,k)=>i>=3000?0:.002+arrangement*(t%((k%3+1)*173)<73?.2:.01));
  const m=a.update(s,t,h,true,beatTurns),ref=b.update(s,t,baseline,true,beatTurns);
  f.update(a,m,t);assert.deepEqual(m,ref);h=m.direction;baseline=ref.direction;
 }
 assert.ok(f.trace.some(v=>v.to!=='directed')&&f.trace.some(v=>v.to==='directed'));
}
console.log('PASS Single baseline; finite event-triggered Counterflow/Crossflow accents; no level latching, extension, queued/cyclic accents or equal-hit Crossflow; bounded busyness at 30/60/120Hz; deterministic replay; exact original steering/speed inputs.');
