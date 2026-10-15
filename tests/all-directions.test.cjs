const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('matrix-rain-utility-suite.html','utf8');
const source=html.slice(html.indexOf('        const rainMotion ='),html.indexOf('        function drawMatrixRain()'));
const ctx=vm.createContext({
 window:{columnOrder:Array.from({length:80},(_,i)=>(i*31)%80)},
 MatrixRainEngine:{rainConfig:{direction:'down',fontSize:10}},
 matrixCanvas:{width:800,height:600},matrixDrops:Array(80).fill(20),
 matrixCtx:{globalAlpha:1,fillStyle:'#00ff41'},rainCameraGPU:{failed:false,lost:false,invalidate:false},
 reverseFlowMultiplier:1,performance,console
});
vm.runInContext(fs.readFileSync('rain-all-directions.js','utf8'),ctx);
vm.runInContext(source,ctx);
vm.runInContext([...html.matchAll(/^        function recomputeActiveColumnsMask\(\) \{[\s\S]*?^        \}/gm)].at(-1)[0],ctx);
vm.runInContext(fs.readFileSync('rain-camera.js','utf8').split("window.addEventListener('DOMContentLoaded'")[0],ctx);
vm.runInContext(`
 globalThis.camera=rainCamera;globalThis.motion=rainMotion;
 globalThis.active=window.columnOrder.slice(0,40);
 globalThis.prepare=()=>prepareRainMotion(10);
 globalThis.tick=()=>{
   prepareRainMotion(10);
   for(const i of active){paintRainCharacter('カ',rainPosition(i,10).x,rainPosition(i,10).y,i,10);advanceRainPosition(i,10,1);}
   rainCamera.frame++;
 };
 for(let i=0;i<80;i++){const p=rainPosition(i,10);p.x=160+(i%20)*20;p.y=100+Math.floor(i/20)*60;p.depth=450;}
`,ctx);
const mode=ctx.window.rainAllDirections,headings=['down','up','right','left','toward','away'];
for(const heading of headings){
 ctx.MatrixRainEngine.rainConfig.direction=heading;
 const counts=Object.fromEntries(headings.map(h=>[h,0]));
 for(const i of ctx.active)counts[mode.directionFor(i,true)]++;
 assert.ok(Object.values(counts).every(n=>n===6||n===7),'All six headings stay populated under every conductor rotation');
}
ctx.MatrixRainEngine.rainConfig.direction='down';
const expected={down:[0,10,0],up:[0,-10,0],right:[10,0,0],left:[-10,0,0],toward:[0,0,-10],away:[0,0,10]};
ctx.tick();
for(let frame=1;frame<260;frame++){
 ctx.tick();
 const last=ctx.camera.marks.slice(-40);
 assert.equal(last.length,40,'The original density supplies the whole population');
 for(const mark of last){
   const v=expected[mode.directionFor(mark.streamId,true)];
   for(let j=0;j<3;j++)assert.ok(Math.abs(mark.delta[j]-v[j])<1e-7,`World axis ${j} remains consistent across X/Y/Z wrapping: ${mark.delta} vs ${v}`);
 }
}
// Turns preserve the last visible joints and the immutable history, while the
// cohorts rotate together with the existing audio heading.
for(const heading of [...headings.slice(1),headings[0]]){
 const before=ctx.camera.marks.slice(-40).map(m=>[m.x,m.y,m.z]);
 ctx.MatrixRainEngine.rainConfig.direction=heading;ctx.tick();
 const after=ctx.camera.marks.slice(-40);
 for(let i=0;i<after.length;i++)for(let j=0;j<3;j++)assert.ok(Math.abs(after[i][['x','y','z'][j]]-before[i][j])<1e-7,'Conductor turns join the existing trail');
}
ctx.MatrixRainEngine.rainConfig.direction='down';ctx.tick();ctx.reverseFlowMultiplier=-1;ctx.tick();ctx.tick();
for(const mark of ctx.camera.marks.slice(-40)){
 const v=expected[mode.directionFor(mark.streamId,true)];
 for(let j=0;j<3;j++)assert.ok(Math.abs(mark.delta[j]+v[j])<1e-7,'Reverse flow applies to every cohort');
}
// Changing density preserves cohort assignment for existing streams.
const first=ctx.active.map(i=>mode.directionFor(i,true));
ctx.window.columnOrder.push(80);
assert.deepEqual(ctx.active.map(i=>mode.directionFor(i,true)),first);
const planar=new Set(ctx.active.map(i=>mode.directionFor(i,false)));
assert.deepEqual([...planar].sort(),['down','left','right','up']);
ctx.MatrixRainEngine.rainConfig.density=1;ctx.recomputeActiveColumnsMask();
const low=ctx.window.activeColumnsMask.flatMap((on,i)=>on?[i]:[]);
assert.equal(low.length,6);assert.equal(new Set(low.map(i=>mode.directionFor(i,true))).size,6,'Low density still has all six directions');
const history=ctx.camera.marks.length;
mode.setEnabled(false);assert.equal(mode.directionFor(0,true),null);assert.equal(ctx.window.activeColumnsMask.filter(Boolean).length,1,'Single mode restores the original density floor');
assert.equal(ctx.camera.marks.length,history,'Switching modes never clears trails');
ctx.tick();ctx.tick();
for(const mark of ctx.camera.marks.slice(-40))for(let j=0;j<3;j++)assert.ok(Math.abs(mark.delta[j]-[0,-10,0][j])<1e-7);
assert.ok(ctx.camera.marks.every(m=>m.char==='カ'&&m.color==='#00ff41'),'Characters and birth colors remain intact');
console.log('PASS balanced simultaneous axes, coherent conductor rotations, 260 frames of X/Y/Z wrapping, fixed world velocity, turn joints, reverse flow, density stability, flat four-direction mode, original single-direction fallback and intact history/colors.');
