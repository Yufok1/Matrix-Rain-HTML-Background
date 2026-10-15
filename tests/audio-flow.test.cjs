const assert=require('node:assert/strict'),fs=require('node:fs');
const load=require('./load-runtime.cjs'),Motion=load('beat-turns-policy.js'),Flow=load('rain-audio-flow.js');
const modes=['directed','counterflow','crossflow'];
function run({period=500,beatTurns=true,scale=1,seed='directed',generate,seconds=48}={}){
 const motion=new Motion(),untouched=new Motion(),flow=new Flow();flow.reset(seed);
 let heading='down',baseline='down';const snapshots=[];
 for(let frame=0;frame<seconds*60;frame++){
  const now=frame*1000/60,phase=Math.floor(now/12000)%4,hit=now%period<90;
  const s=generate?generate(now):new Float32Array(64);
  if(!generate){
   if(phase===0){s.fill(.001);s[24]=hit?.25:.04;}
   if(phase===1){s.fill(hit?.35:.1);s[24]=.3;}
   if(phase===2){s.fill(.0001);s[24]=hit?.04:.001;}
  }
  for(let i=0;i<s.length;i++)s[i]*=scale;
  const out=motion.update(s,now,heading,true,beatTurns),base=untouched.update(s,now,baseline,true,beatTurns);
  const before=JSON.stringify(out),bands=[...motion.bandFast];
  flow.update(motion,out,now);heading=out.direction;baseline=base.direction;
  assert.equal(JSON.stringify(out),before,'Formation observation cannot alter the accepted motion result');
  assert.deepEqual([...motion.bandFast],bands,'Existing envelopes are read only');
  assert.deepEqual(out,base,'Fast steering, propulsion and Beat turns stay exactly as before');
  snapshots.push(flow.snapshot.mode);
 }
 for(const step of flow.trace){const distance=Math.abs(modes.indexOf(step.from)-modes.indexOf(step.to));assert.ok(distance===1||(step.from==='crossflow'&&step.to==='directed'&&step.reason==='Gathering on a breakdown'),'Only a real breakdown can gather Crossflow directly into Single');}
 return {flow,motion,snapshots};
}
for(const beatTurns of [false,true])for(const period of [333.3333,500,750]){
 const result=run({period,beatTurns});
 assert.deepEqual(new Set(result.flow.trace.map(t=>t.to)),new Set(modes),'Music visits every formation');
 assert.equal(result.flow.trace.at(-1).to,'directed','The final silence settles to Single');
 assert.ok(result.flow.trace.length>=8,'Pulsed sections keep breathing rather than parking in Crossflow');
 for(let i=1;i<result.flow.trace.length;i++)assert.ok(result.flow.trace[i].time-result.flow.trace[i-1].time>=1399,'Formation has room to be seen');
 assert.ok(result.motion.eventCount>20,'The faster dancing controller still detects music');
 assert.deepEqual(run({period,beatTurns}).flow.trace,result.flow.trace,'The same music yields the same formation decisions');
}
const steady=run({generate:()=>new Float32Array(64).fill(.12)});
assert.equal(steady.flow.trace.length,0,'Elapsed time cannot cycle a held sound');
const narrow=run({generate:now=>{const s=new Float32Array(64);s[8]=now%500<90?.25:.02;return s;}});
assert.ok(narrow.flow.trace.length>8,'A recurring real beat gives the formation a musical breathing cadence');
assert.deepEqual(narrow.flow.trace.slice(0,4).map(t=>t.to),['counterflow','crossflow','counterflow','directed'],'A steady pulse traces the ordered expansion and contraction');
const silence=run({seed:'crossflow',generate:()=>new Float32Array(64),seconds:12});
assert.equal(silence.flow.trace.at(-1).to,'directed','Silence resolves to Single');assert.ok(silence.flow.trace.length<=2,'Silence cannot cycle formations');
const quiet=run({scale:.1});assert.ok(quiet.flow.trace.some(t=>t.to==='crossflow'),'Lower playback level remains responsive');
{
 const result=run({seconds:24}),f=result.flow,before=f.snapshot.mode;
 const noAttack={accent:false,flux:0,impulse:0};
 f.update(result.motion,noAttack,120000);assert.equal(f.snapshot.mode,before,'Returning after a gap cannot create a transition');
 assert.equal(f.confidence,0,'An old pulse estimate is not carried across a pause');
}
const html=fs.readFileSync('matrix-rain-utility-suite.html','utf8');
assert.match(html,/rainAllDirections\?\.updateAudio\?\.\(audioMotion, musicalMotion, audioNow\)/,'Actual HTML feeds the accepted analysis into flow');
const codec=load('rain-settings-codec.js'),fixture=require('./settings-codec-ui.test.cjs');
for(const flowFollow of [true,false])for(const flow of modes){
 const s=structuredClone(fixture);s.rain.flow=flow;s.audio.flowFollow=flowFollow;
 assert.deepEqual(codec.decode(codec.encode(s)),s);
}
for(const length of [3,4,7]){
 const f=new Flow();for(let i=0;i<length*7;i++){const shape=Array(6).fill(.03);shape[i%length%6]=.85;f.remember(i*500,shape,(i%length===0?1.1:.3)+(i%length)*.03);}
 assert.equal(f.phraseLength,length,'Repeated spectral/rhythmic motif length is learned, not fixed at four');
}
{const f=new Flow();for(let i=0;i<120;i++)f.remember(i*500,Array(6).fill(1/6),.6);assert.equal(f.phraseLength,0,'Unaccented identical pulses cannot prove a meter');assert.equal(f.notes.length,72,'Memory is bounded');}
assert.equal(silence.flow.trace[0].from,'crossflow');assert.equal(silence.flow.trace[0].to,'directed','A real breakdown can gather Crossflow directly into Single');
const old=structuredClone(fixture);old.v=12;delete old.audio.flowFollow;
assert.equal(codec.decode('MR12.'+Buffer.from(JSON.stringify(old)).toString('base64url')).audio.flowFollow,false,'Old codes retain manual formation');
console.log('PASS musical builds/releases at three pulse rates, ordered breathing and meaningful breakdown collapses, quiet playback, deterministic timing, no timer cycling, exact fast-motion parity, pause recovery and MR13 preference round trips.');
