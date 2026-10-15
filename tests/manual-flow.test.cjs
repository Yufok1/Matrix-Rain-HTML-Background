const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('matrix-rain-utility-suite.html','utf8'),runtime=fs.readFileSync('rain-all-directions.js','utf8');
assert.doesNotMatch(html,/rain-audio-flow\.js|rainAllDirections\?\.(?:updateAudio|resetAudio)/);
assert.ok(!fs.existsSync('rain-audio-flow.js'),'Retired controller is removed');
assert.doesNotMatch(runtime,/flow-follow-music|setFollowMusic|audioOwned|liveExpansion/);
function setup(flat,reverse,mode){
 const saved=new Map([['matrixRain.flow',mode],['matrixRain.flowFollowMusic','true'],['matrixRain.flowFollowMusic.optIn','1']]);
 const localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
 const ctx=vm.createContext({window:{columnOrder:Array.from({length:80},(_,i)=>i)},localStorage,MatrixRainEngine:{rainConfig:{direction:'down',fontSize:10}},
 matrixCanvas:{width:800,height:600},matrixDrops:Array(80).fill(20),matrixCtx:{globalAlpha:1,fillStyle:'#00ff41',fillText(){}},rainCameraGPU:{failed:false,lost:false,invalidate:false},reverseFlowMultiplier:reverse,performance,console});
 vm.runInContext(runtime,ctx);
 vm.runInContext(html.slice(html.indexOf('        const rainMotion ='),html.indexOf('        function drawMatrixRain()')),ctx);
 vm.runInContext([...html.matchAll(/^        function recomputeActiveColumnsMask\(\) \{[\s\S]*?^        \}/gm)].at(-1)[0],ctx);
 vm.runInContext(fs.readFileSync('rain-camera.js','utf8').split("window.addEventListener('DOMContentLoaded'")[0],ctx);
 vm.runInContext(`globalThis.camera=rainCamera;globalThis.motion=rainMotion;globalThis.tick=()=>{prepareRainMotion(10);for(let i=0;i<32;i++){const p=rainPosition(i,10);paintRainCharacter('カ',p.x,p.y,i,10);advanceRainPosition(i,10,.85);}rainCamera.frame++;};
 for(let i=0;i<80;i++){const p=rainPosition(i,10);p.depth=100+(i%4)*125;p.x=100+(i%16)*40;p.y=200+(i%3)*30;}`,ctx);
 ctx.camera.enabled=!flat;
 assert.equal(ctx.window.rainAllDirections.mode,mode,'Restore manual choice even with stale automatic preferences');
 assert.equal(saved.has('matrixRain.flowFollowMusic'),false,'Retired preference is cleared');
 return {ctx,saved};
}
for(const flat of [false,true])for(const reverse of [1,-1])for(const mode of ['directed','counterflow','crossflow']){
 const {ctx,saved}=setup(flat,reverse,mode),flow=ctx.window.rainAllDirections;
 ctx.tick();const old=ctx.camera.marks.map(m=>[m.x,m.y,m.z,m.color]);
 for(let frame=0;frame<180;frame++){
  ctx.window.audioReactiveActive=frame%4<2;ctx.window.rainSessionControls={stopped:frame%7===0,audioPaused:frame%9===0};
  ctx.MatrixRainEngine.rainConfig.direction=frame<120?['down','right','up','left'][Math.floor(frame/30)%4]:'down';
  ctx.tick();assert.equal(flow.mode,mode,'Audio and pause state cannot replace a manual pattern');
 }
 const headings=new Set(ctx.motion.drops.slice(0,32).map(p=>p.lastStepDirection));
 assert.equal(headings.size,mode==='directed'?1:mode==='counterflow'?2:flat?4:6,'Actual heads match the chosen manual formation');
 assert.deepEqual(ctx.camera.marks.slice(0,old.length).map(m=>[m.x,m.y,m.z,m.color]),old,'Birth history stays fixed');
 flow.setMode(mode==='directed'?'crossflow':'directed');assert.equal(saved.get('matrixRain.flow'),flow.mode,'Manual switching still saves its choice');
}
console.log('PASS manual-only Single/Counterflow/Crossflow: saved legacy preferences, live audio and pause state, actual heads in flat/3D/reverse, immutable trails and saved manual swaps.');
