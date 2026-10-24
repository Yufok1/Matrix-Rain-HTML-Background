const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const fixture=require('./auto-cloud.test.cjs'),codec=require('./load-runtime.cjs')('rain-settings-codec.js');
function setup(audio=false){const h=fixture(audio);h.window.RainSettingsCodec=codec;vm.runInContext(fs.readFileSync('rain-auto-preferences.js','utf8'),h.context);h.policy=h.window.rainAutoPreferences;return h;}
function keep(p){for(const k of ['camera','flow','characters','direction','size','density','speed'])p[k].change=false;p.colors=p.trails=p.clarity=false;return p;}
function only(p,key,...values){p[key].change=true;for(const v of Object.keys(p[key].allowed))p[key].allowed[v]=values.includes(v);}
// Standalone and audio retain actual spatial progress; cloud stays opt-in.
for(const audio of [false,true]){
 const h=setup(audio);h.start(.1);h.advance(900);
 assert.ok(h.steps.length>30);assert.ok(h.steps.some(s=>s.kind==='depth'),'Explore flat and 3D');
 assert.equal(h.calls.length,0);assert.ok(h.scenes.loadBudget().work<=11000);
}
// Arbitrary dwell times, continuous lone camera, no recurring camera restart.
for(const [rain,cloud]of [[.1,.1],[.5,.25],[1,5],[4,9]]){
 const h=setup(),p=keep(h.policy.capture());only(p,'camera','gyroscope');
 p.appearances.rain.min=p.appearances.rain.max=rain;p.appearances.cloud={enabled:true,min:cloud,max:cloud};
 h.camera.speeds.gyroscope=.78;h.policy.applyProgram(p);h.start(.1);h.advance(100);
 const exits=h.calls.filter(c=>!c.on),entries=h.calls.filter(c=>c.on);
 assert.ok(exits.length>=4);assert.ok(exits.every(c=>Math.abs(c.age-(cloud+2))<.12),'Full stay follows the unchanged two-second entry');
 for(let i=1;i<entries.length;i++)assert.ok(Math.abs(entries[i].time-exits[i-1].time-2-rain)<.2,'Rain dwell follows full return');
 assert.equal(h.camera.mode,'gyroscope');assert.equal(h.camera.speeds.gyroscope,.78);
 assert.equal(h.steps.filter(s=>s.kind==='camera').length,1);assert.equal(h.steps.filter(s=>s.kind==='depth').length,0);
}
// Rain-only, cloud-only, manual override, stop/resume, pause preserve ownership.
{
 const h=setup(),p=keep(h.policy.capture());p.appearances.rain.enabled=false;p.appearances.cloud.enabled=true;
 h.policy.applyProgram(p);h.start(.1);h.advance(40);assert.equal(h.calls.length,1);assert.equal(h.cloud.active,true);
 h.policy.manual();h.cloud.choose(false);h.advance(30);assert.equal(h.calls.length,2,'Manual choice stays held');
 h.policy.held=false;h.advance(10);assert.equal(h.calls.length,3);
 const both=h.policy.capture();both.appearances.rain.enabled=true;h.policy.applyProgram(both);h.advance(2);
 h.window.rainSessionControls.stopped=true;const elapsed=h.policy.elapsed;h.advance(20);assert.equal(h.policy.elapsed,elapsed);
 h.window.rainSessionControls.stopped=false;h.context.autoOrchestratorActive=false;h.context.stopAutoOrchestrator();h.policy.stop();h.advance(30);assert.equal(h.calls.length,3);
 h.start(.1);h.advance(12);assert.ok(h.calls.length>3);
}
// Selected pools constrain destinations, and listed order is genuinely ordered.
{
 const h=setup(),p=keep(h.policy.capture());p.order='sequence';only(p,'camera','showcase','gyroscope');only(p,'flow','directed','counterflow');only(p,'characters','binary','hex');
 h.policy.applyProgram(p);h.start(.1);const modes=new Set(),flows=new Set(),chars=new Set();
 for(let i=0;i<900;i++){h.advance(.2);if(!h.camera.motionFade)modes.add(h.camera.mode);flows.add(h.window.rainAllDirections.mode);chars.add(h.config.characterSet);}
 assert.ok(modes.has('showcase')&&modes.has('gyroscope'));assert.ok(!modes.has('corkscrew'));
 assert.ok(flows.has('counterflow'));assert.ok(!flows.has('crossflow'));assert.ok(chars.has('hex')&&chars.has('binary'));
 assert.equal(h.policy.choose('characters','binary'),'hex');assert.equal(h.policy.choose('characters','hex'),'binary');
}
// Kept values, narrowed ranges, and unavailable choices cannot stall valid work.
{
 const h=setup(),p=keep(h.policy.capture());h.config.fontSize=25;h.config.density=55;h.config.speed=20;
 h.policy.applyProgram(p);const before=JSON.stringify(h.config);h.start(.1);h.advance(30);assert.equal(JSON.stringify(h.config),before);assert.equal(h.steps.length,0);
 p.size={change:true,min:22,max:24};p.density={change:true,min:20,max:30};h.policy.applyProgram(p);h.advance(40);
 assert.ok(h.config.fontSize>=22&&h.config.fontSize<=24);assert.ok(h.config.density<=30);
 h.camera.enabled=false;only(p,'direction','toward');only(p,'characters','custom');h.policy.applyProgram(p);h.advance(40);
 assert.equal(h.policy.familyAllowed('direction'),false);assert.equal(h.policy.familyAllowed('characters'),false);assert.ok(h.steps.filter(s=>s.kind==='size').length>1);
}
// Dwell ranges vary within their limits, and configuration codes preserve all choices.
{
 const h=setup(),p=keep(h.policy.capture());p.appearances.rain={enabled:true,min:.5,max:2};p.appearances.cloud={enabled:true,min:5,max:8};
 h.policy.applyProgram(p);h.start(.1);h.advance(200);const ages=h.calls.filter(c=>!c.on).map(c=>c.age-2);
 assert.ok(ages.length>10&&ages.every(a=>a>=5&&a<8.1));assert.ok(Math.max(...ages)-Math.min(...ages)>1);
 vm.runInContext(fs.readFileSync('rain-auto-preferences.js','utf8'),h.context);assert.equal(JSON.stringify(h.window.rainAutoPreferences.capture()),JSON.stringify(p));
 const visual=require('./settings-codec-ui.test.cjs'),v17={...visual,v:17,auto:{interval:.1,program:p}},blob=codec.encode(v17);
 assert.match(blob,/^MR17\./);assert.deepEqual(JSON.parse(JSON.stringify(codec.decode(blob))),JSON.parse(JSON.stringify(v17)));
 for(const change of [x=>x.appearances.cloud.min=.09,x=>x.appearances.cloud.max=.09,x=>x.appearances.rain.min=4,x=>x.camera.allowed={flat:true},x=>x.size.min=14.5,x=>x.extra=true,x=>{x.appearances.rain.enabled=x.appearances.cloud.enabled=false;}]){
  const bad=structuredClone(p);change(bad);assert.throws(()=>codec.validateProgram(bad));
 }
 h.window.rainAutoPreferences.reset();assert.equal(h.window.rainAutoPreferences.program.appearances.cloud.enabled,false);
}
console.log('PASS: configurable stays/ranges, rain/cloud-only, continuous selected camera, native timing, audio ownership, selected pools/order, kept values, workload bounds, manual/stop/pause and MR17 persistence.');
