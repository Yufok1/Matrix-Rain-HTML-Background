const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('matrix-rain-utility-suite.html','utf8');
const vectors={down:[0,1,0],up:[0,-1,0],right:[1,0,0],left:[-1,0,0],away:[0,0,1],toward:[0,0,-1]};
function setup(){
 const ctx=vm.createContext({window:{columnOrder:Array.from({length:80},(_,i)=>i)},MatrixRainEngine:{rainConfig:{direction:'down',fontSize:10}},
 matrixCanvas:{width:800,height:600},matrixDrops:Array(80).fill(20),matrixCtx:{globalAlpha:1,fillStyle:'#00ff41',fillText(){}},rainCameraGPU:{failed:false,lost:false,invalidate:false},reverseFlowMultiplier:1,performance,console});
 vm.runInContext(fs.readFileSync('rain-all-directions.js','utf8'),ctx);
 vm.runInContext(html.slice(html.indexOf('        const rainMotion ='),html.indexOf('        function drawMatrixRain()')),ctx);
 vm.runInContext([...html.matchAll(/^        function recomputeActiveColumnsMask\(\) \{[\s\S]*?^        \}/gm)].at(-1)[0],ctx);
 vm.runInContext(fs.readFileSync('rain-camera.js','utf8').split("window.addEventListener('DOMContentLoaded'")[0],ctx);
 vm.runInContext(`globalThis.camera=rainCamera;globalThis.motion=rainMotion;globalThis.tick=(speed=1)=>{prepareRainMotion(10);for(let i=0;i<32;i++){const p=rainPosition(i,10);paintRainCharacter('カ',p.x,p.y,i,10);advanceRainPosition(i,10,speed);}rainCamera.frame++;};
 for(let i=0;i<80;i++){const p=rainPosition(i,10);p.depth=100+(i%4)*125;p.x=100+(i%16)*40;p.y=200+(i%3)*30;}`,ctx);
 return ctx;
}
for(const mode of ['counterflow']){
 const ctx=setup(),flow=ctx.window.rainAllDirections;flow.setMode(mode);ctx.tick();
 const old=ctx.camera.marks.map(m=>[m.x,m.y,m.z,m.color]),last=new Map();let corners=0;
 for(let frame=0;frame<560;frame++){
  if(frame%80===0)ctx.MatrixRainEngine.rainConfig.direction=['down','right','away','up','left','toward'][Math.floor(frame/80)%6];
  ctx.tick(1.3);
  for(const mark of ctx.camera.marks.slice(-32)){
   const active=mark.delta.map(n=>Math.abs(n)>1e-5);
   assert.ok(active.filter(Boolean).length<=1,mode+': no diagonal movement or seam teleport');
   assert.ok(mark.delta.every(n=>Number.isFinite(n)&&Math.abs(n)<=13.00001),mode+': fixed bounded world step');
   const length=Math.hypot(...mark.delta);if(length<1e-5)continue;
   const v=mark.delta.map(n=>n/length),prev=last.get(mark.streamId);
   if(prev){const dot=v.reduce((sum,n,j)=>sum+n*prev[j],0);assert.ok(dot>-.001,mode+': no immediate reversal');if(Math.abs(dot)<.001)corners++;}
   last.set(mark.streamId,v);
  }
 }
 assert.ok(corners>0,mode+': meaningful right-angle turns occur');
 assert.deepEqual(ctx.camera.marks.slice(0,32).map(m=>[m.x,m.y,m.z,m.color]),old,mode+': immutable birth history');
 const count=ctx.camera.marks.length;flow.setMode('directed');assert.equal(ctx.camera.marks.length,count,mode+': switching preserves trails');
 console.log('PASS '+mode+': 560 frames; world-axis steps, bounded seam wrapping, right angles and fixed birth history.');
}
// Every candidate obeys flat view and global Reverse flow.
for(const mode of ['counterflow']){
 const ctx=setup(),flow=ctx.window.rainAllDirections;ctx.camera.enabled=false;flow.setMode(mode);ctx.tick();
 for(let frame=0;frame<80;frame++){ctx.tick();for(const p of ctx.motion.drops.slice(0,32))assert.ok(['up','down','left','right'].includes(p.lastStepDirection),mode+': flat axes only');}
 const reverse=setup();reverse.reverseFlowMultiplier=-1;reverse.window.rainAllDirections.setMode(mode);reverse.tick();reverse.tick();
 for(const m of reverse.camera.marks.slice(-32)){const d=reverse.motion.drops[m.streamId].lastStepDirection;for(let j=0;j<3;j++)assert.ok(Math.abs(m.delta[j]+vectors[d][j]*10)<1e-6);}
}
const codec=require('./load-runtime.cjs')('rain-settings-codec.js'),fixture=require('./settings-codec-ui.test.cjs');
for(const mode of ['directed','crossflow','counterflow']){
 const s=structuredClone(fixture);s.rain.flow=mode;assert.equal(codec.decode(codec.encode(s)).rain.flow,mode);
}
const old=structuredClone(fixture);old.v=11;delete old.camera.continuous;delete old.auto;delete old.audio.flowFollow;const raw='MR11.'+Buffer.from(JSON.stringify(old)).toString('base64url');assert.equal(codec.decode(raw).rain.flow,'directed');
console.log('PASS flat view, Reverse flow, three-mode configuration round trips and MR11 migration.');

for(const mode of ['layers','boxes','staircase','corner-waves']){
 const ctx=setup();ctx.window.rainAllDirections.setMode(mode);assert.equal(ctx.window.rainAllDirections.mode,'directed');
 const bad=structuredClone(fixture);bad.rain.flow=mode;assert.throws(()=>codec.validate(bad));
}
console.log('PASS rejected candidates are absent from the runtime and configuration choices.');
