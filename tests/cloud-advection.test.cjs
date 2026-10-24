const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=n=>fs.readFileSync(n,'utf8');
class FieldFixture{
 constructor(){this.ready=true;this.queries=0;}
 setAnchor(){} step(){}
 sample(marks){this.flow=new Float32Array(marks.length*4);this.colors=new Float32Array(marks.length*4);for(let i=0;i<marks.length;i++){this.flow.set([80,60,20,1],i*4);this.colors.set([.8,.3,.2,.5],i*4);}this.queries++;return true;}
}
function fixture(variety=false,stepped=true,prepared=true){
 const window={OmniCloud:FieldFixture,matrixRainRendering:{smooth:true},matrixRainTrails:{enabled:variety,stepped,lengthFor:i=>variety?60+i:40},addEventListener(){}};
 const context=vm.createContext({window,performance,console,Math,Map,Set,Float32Array,matrixCanvas:{width:960,height:600},rainFocalLength:500,rainMotion:{drops:[],planar:'down'},reverseFlowMultiplier:1,MatrixRainEngine:{rainConfig:{direction:'down',speed:35,fontSize:12,intensity:70}},rainCameraGPU:{invalidate:false,stats:{phase:.37},color:()=>[0,.8,.2],tileVisible:()=>true,hide(){},render(){}}});
 vm.runInContext(read('rain-camera-motion.js'),context);
 const camera=vm.runInContext(read('rain-camera.js').split("window.addEventListener('DOMContentLoaded'")[0]+';rainCamera;',context);
 vm.runInContext(read('rain-cloud.js'),context);const cloud=window.rainCloud;if(prepared)cloud.engine=new FieldFixture();
 function capture(){for(let i=0;i<8;i++){const h=context.rainMotion.drops[i];h.y+=2;camera.capture('ア',h.x,h.y,h.depth,12,.8,'#00cc33',i);}}
 for(let f=0;f<40;f++){for(let i=0;i<8;i++){const h=context.rainMotion.drops[i]={x:100+i*95,y:60+f*9,depth:180+i*43,lastStepDirection:'down'};camera.capture('ア',h.x,h.y,h.depth,12,.8,'#00cc33',i);}camera.advanceFrame();}
 camera.beginContinuousView();camera.yaw=18;camera.pitch=8;camera.roll=27;camera.prepareView();
 const pack=vm.runInNewContext(read('rain-camera-gpu.js')+';rainCameraGPU.pack;',{rainCamera:camera});
 const packer={stride:22,capacity:1024,write:0,glyph:()=>({uv:[0,0,1,1],shape:[0,-.8,.6,0],mode:0}),color:()=>[0,.8,.2]};
 const packed=p=>{const a=new Float32Array(22);pack.call(packer,p,0,a);return Array.from(a);};
 return{window,camera,cloud,context,capture,packed};
}
const xyz=p=>[p.x,p.y,p.z];
function close(a,b,message,tolerance=.001){assert.equal(a.length,b.length);for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i]-b[i])<tolerance,`${message}: ${a[i]} != ${b[i]}`);}
function step(f,dt=1/60){f.capture();f.camera.advanceFrame();f.cloud.advance(dt,f.camera);assert.equal(f.cloud.error,undefined);}
function gather(f){let n=0;while(f.cloud.gathering&&n++<300)step(f);assert.ok(n<300);}
// A fresh/reloaded default screen does zero cloud initialization or GPU work.
// Even a remembered Auto opt-in stays idle until Auto is actually running.
{
 const f=fixture(false,true,false),{cloud,camera,context,window}=f;
 window.rainAutoScenes={includeCloud:true};context.autoOrchestratorActive=false;
 for(let i=0;i<360;i++)cloud.advance(1/60,camera);
 assert.equal(cloud.engine,undefined,'Default rain never constructs the cloud renderer');
 class DelayedField extends FieldFixture{constructor(){super();this.ready=false;this.warm=0;}step(){this.ready=++this.warm>=3;}}
 window.OmniCloud=DelayedField;
 const originals=camera.marks.slice();cloud.choose(true);
 assert.equal(cloud.active,false);assert.equal(cloud.enterRequested,true);
 cloud.advance(.02,camera);assert.deepEqual(camera.marks,originals,'Preparation leaves all native rain untouched');
 cloud.choose(false);cloud.advance(.02,camera);cloud.advance(.02,camera);
 assert.equal(cloud.engine.ready,true);assert.equal(cloud.active,false,'Cancelled first use cannot enter later');
 const warm=cloud.engine.warm;for(let i=0;i<20;i++)cloud.advance(.02,camera);
 assert.equal(cloud.engine.warm,warm,'Prepared but unused cloud consumes no simulation steps');
 cloud.choose(true);assert.equal(cloud.active,true,'Prepared transition still begins immediately');
}
{
 const f=fixture(false,true,false),{cloud,camera,window}=f;
 class DelayedField extends FieldFixture{constructor(){super();this.ready=false;this.warm=0;}step(){this.ready=++this.warm>=3;}}
 window.OmniCloud=DelayedField;cloud.choose(true);
 for(let i=0;i<3;i++)cloud.advance(.02,camera);
 assert.equal(cloud.active,true,'First click enters automatically once ready');assert.equal(cloud.enterRequested,false);
 cloud.release();let n=0;while(cloud.active&&n++<150)step(f);assert.ok(n<150);
}
for(const [variety,stepped]of [[false,true],[false,false],[true,true],[true,false]]){
 const f=fixture(variety,stepped),{cloud,camera,packed}=f;
 const originals=camera.marks.slice(),latest=new Map();for(const p of originals)latest.set(p.streamId,p);
 const tails=originals.filter(p=>p!==latest.get(p.streamId)),tailBytes=tails.map(packed);
 const nativeAlpha=(p,lead=0)=>{
  const age=camera.frame-1-p.frame+lead,length=variety?p.trailLength:40;if(age>=length)return 0;
  const fade=stepped?[1,.68,.45,.29,.18,.105,.06,.032][Math.floor(age/length*8)]:variety?Math.exp(-4*age/length)*(1-age/length):Math.pow(.88,age);
  return p.alpha*fade;
 };
 cloud.choose(true);
 const heads=cloud.heads.slice(),positions=heads.map(xyz),shape=heads.map(p=>[p.char,p.fontSize]);
 assert.ok(heads.length>8);assert.equal(cloud.tapeSlots,heads.length);
 for(let i=0;i<tails.length;i++)assert.deepEqual(packed(tails[i]),tailBytes[i],'Activation does not touch native trail inputs');
 // Cloud motion starts on the first repaint, without waiting for a rain tick
 // or for any of the original trails to fade.
 cloud.advance(.02,camera);
 for(let i=0;i<heads.length;i++)assert.notDeepEqual(xyz(heads[i]),positions[i],'Head moves on the first repaint');
 assert.equal(cloud.gathering,false);
 for(let i=0;i<heads.length;i++)assert.deepEqual([heads[i].char,heads[i].fontSize],shape[i]);
 for(let ticks=0;ticks<35;ticks++){
  step(f);
  for(let i=0;i<tails.length;i++){
   assert.deepEqual(packed(tails[i]),tailBytes[i],'Every native trail byte stays unchanged throughout entry');
   assert.equal(tails[i].cloudAge,undefined);assert.equal(tails[i].cloudAlpha,undefined);
   if(nativeAlpha(tails[i])>=.003)assert.ok(camera.marks.includes(tails[i]),'Visible native tail is never cut off');
  }
 }
 assert.ok(heads.every(p=>p.cloudRGB[0]===0),'Source green palette never becomes Cloud orange/red');
 const before=heads.map(xyz);cloud.release();assert.deepEqual(heads.map(xyz),before,'Return starts without a jump');
 const departure=heads.map(p=>[p.cloudState.vx,p.cloudState.vy,p.cloudState.vz]);let n=0;
 while(cloud.active&&n++<150){
  const previous=heads.map(xyz);step(f);
  if(cloud.active)assert.ok(camera.marks.every(p=>p.cloudInstance||tails.includes(p)),'Only the same heads and surviving original tails before arrival');
 }

 assert.ok(n<150);assert.equal(cloud.active,false);
 for(const p of heads){const native=camera.marks.find(m=>m.streamId===p.streamId),shift=cloud.ownership.get(p.streamId).cells.get(p.cellOffset.join(',')).shift;close(xyz(p),xyz(native).map((v,k)=>v+p.cellOffset[k]+shift[k]),'Coincident native handoff at the returned position');}
 const native=new Map(camera.marks.map(p=>[p.streamId,p]));f.capture();camera.advanceFrame();
 for(const p of camera.marks.slice(-8)){const h=native.get(p.streamId);close(xyz(p),[h.x,h.y+2/(500/f.context.rainMotion.drops[p.streamId].depth),h.z],'First native step starts at the returned head');}
}
// Run native ticks and repaint clocks independently. Slow/long trails remain
// visible when heads launch, but cannot delay cloud motion beyond one repaint.
for(const fps of [30,60,120])for(const speed of [10,35,80]){
 const f=fixture(true,false),{camera,cloud}=f;f.context.MatrixRainEngine.rainConfig.speed=speed;
 for(const p of camera.marks)p.trailLength=140;
 const originals=new Set(camera.marks);cloud.choose(true);
 const p=cloud.heads.find(p=>p.streamId===0),start=xyz(p),tails=cloud.homes.get(0).tails.slice(),bytes=tails.map(f.packed);
 let time=0,nextTick=speed/1000;
 while(!cloud.homes.get(0).released&&time<1){
  time+=1/fps;
  while(nextTick<=time+1e-9){f.capture();camera.advanceFrame();nextTick+=speed/1000;}
  cloud.advance(1/fps,camera);assert.equal(cloud.error,undefined);
 }
 assert.equal(time,1/fps,`Cloud starts on the first repaint at ${fps}fps/${speed}ms ticks`);
 assert.notDeepEqual(xyz(p),start,'Head moves on the release repaint');
 assert.ok(tails.some(t=>camera.marks.includes(t)&&t.alpha*cloud.fade(camera.frame-1-t.frame,t.trailLength)>.05),'Visible original trails overlap cloud motion');
 for(let i=0;i<tails.length;i++)assert.deepEqual(f.packed(tails[i]),bytes[i],'Overlapping native tails retain their original shader inputs');
 cloud.release();let frames=0;
 while(cloud.active&&frames++<fps*2+4){
  cloud.advance(1/fps,camera);
  if(cloud.active)assert.ok(camera.marks.every(m=>m.cloudInstance||originals.has(m)),'Early return cannot introduce replacement rain');
 }
 assert.ok(!cloud.active);close(xyz(p),start,'Early return restores the same head to its original home');
}
// Freeze/cancel while gathering: no replacement heads and no detached remnants.
{
 const f=fixture();f.cloud.choose(true);step(f,.02);f.cloud.release();let n=0;while(f.cloud.active&&n++<200)step(f);
 assert.ok(n<200);
 assert.equal(f.cloud.active,false);assert.ok(f.camera.marks.every(p=>!p.cloudInstance&&!p.gatherTail));
}
// Neither short nor long remaining trails delay their heads.
{
 const f=fixture(),{camera,cloud}=f;camera.marks=camera.marks.filter(p=>p.streamId!==0||p.frame<camera.frame-30||p.frame===camera.frame-1);
 cloud.choose(true);const short=cloud.heads.find(p=>p.streamId===0),long=cloud.heads.find(p=>p.streamId===1),a=xyz(short),b=xyz(long);
 cloud.advance(.02,camera);
 assert.equal(cloud.gathering,false);
 assert.notDeepEqual(xyz(short),a,'Short trail head immediately joins the cloud');
 assert.notDeepEqual(xyz(long),b,'Long trail head immediately joins the cloud');
 for(let i=0;i<12;i++)step(f);
 assert.ok(camera.marks.every(p=>p.streamId!==0||p.cloudInstance));
 gather(f);cloud.release();let n=0;while(cloud.active&&n++<150)step(f);
 close(xyz(short),a,'Short trail resumes at its original home');close(xyz(long),b,'Long trail resumes at its original home');
}
// A deliberately small ceiling makes a long rotation hit the limit early.
// Old finite-life fork sources must be retired, not stored forever by Auto scenes.
{
 const f=fixture(),{cloud,camera,context,window}=f;cloud.headBudget=80;cloud.choose(true);gather(f);
 const limit=cloud.limit;let peak=cloud.heads.length;
 for(let n=0;n<3600;n++){
  camera.yaw=n*.7;camera.pitch=35*Math.sin(n/70);camera.roll=n*.3;camera.prepareView();
  if(n%15===0){const source={...cloud.latest.get(0),streamId:'fork-'+n,appearanceId:0,frame:camera.frame,delta:[3,0,0]};cloud.capture(source,camera);}
  step(f);peak=Math.max(peak,cloud.heads.length);
  assert.ok(cloud.heads.length<=limit,'Population never grows past its fixed budget');
  assert.ok(cloud.homes.size<30,'Expired fork ownership is reclaimed');
  assert.ok(cloud.latest.size<40,'Expired source cache is reclaimed');
 }
 assert.equal(peak,limit,'Rotation still fills the denser cloud up to its budget');
 assert.ok(cloud.tape.length<=Math.ceil((cloud.lastReleaseAge+2)*60)+3,'No growing playback tape after entry');
 assert.ok(cloud.heads.every(p=>xyz(p).every(Number.isFinite)));
 context.MatrixRainEngine.rainConfig.fontSize=25;context.MatrixRainEngine.rainConfig.speed=70;
 const source=cloud.latest.get(0);source.rgb=[.6,.1,.4];window.activeColumnsMask=Array(8).fill(true);window.activeColumnsMask[1]=false;
 cloud.appearance(.5,camera);cloud.prune(camera);
 assert.ok(cloud.heads.every(p=>p.fontSize===25),'Cloud uses the current font size');
 assert.equal(cloud.speedScale(),.5,'Cloud follows the native speed setting');
 assert.ok(cloud.heads.filter(p=>p.streamId===0).every(p=>p.cloudRGB[0]>.4&&p.cloudRGB[2]>.25),'Source/audio palette updates reach the cloud');
 assert.ok(cloud.heads.every(p=>p.streamId!==1),'Density can remove disabled heads without leaving hidden work');
 cloud.release();assert.ok(cloud.returnDuration>=2&&cloud.returnDuration<2.05);
 for(let i=0;i<20;i++)step(f);
 const positions=cloud.heads.map(xyz);cloud.choose(true);assert.deepEqual(cloud.heads.map(xyz),positions);
 cloud.release();let n=0;while(cloud.active&&n++<130)step(f);assert.ok(n<130);
 assert.ok(camera.marks.every(p=>!p.cloudInstance&&xyz(p).every(Number.isFinite)));
 // A newly visible unowned cell is hidden; it cannot reveal a whole old trail.
 camera.prepareView();const mask=cloud.ownershipMask(camera);let owned=0,blocked=0;
 for(const owner of cloud.ownership.values())for(let i=0;i<camera.tiles.length;i++){
  const offset=camera.tiles[i].offset,p=owner.point;
  if(owner.cells.has(offset.join(',')))owned++;else if(cloud.visible({...p,x:p.x+offset[0],y:p.y+offset[1],z:p.z+offset[2]},camera))blocked++;
 }
 assert.ok(owned>0&&blocked>0,'Unrepresented copies stay blocked after a capped return');
 const owner=cloud.ownership.values().next().value,before=[...owner.cells.values()].map(x=>x.offset[0]);
 const mark={...owner.point,x:owner.point.x-camera.volume.x+5,delta:[5,0,0]};cloud.trackOwnership(mark,camera);
 const next=cloud.ownership.get(mark.streamId);
 close([...next.cells.values()].map(x=>x.offset[0]),before.map(x=>x+camera.volume.x),'New head ownership follows wrapping');
 close([...owner.cells.values()].map(x=>x.offset[0]),before,'Historical trail stays in its original cells');
 assert.notEqual(next.row,owner.row);assert.equal(mark.ownerRow,next.row);
}
console.log('PASS: first-repaint cloud motion, byte-identical native trails, normal overlapping fade, four fade modes, recorded return handoff, owned return, normal resumed movement, cancellation, 60-second rotating bounded population, expired-source cleanup, palette/size/speed/density, and wrap ownership.');

for(const incoming of [[90,0,0],[-90,0,0],[0,90,0],[0,-90,0],[0,0,90],[0,0,-90]]){
 const f=fixture(),{cloud,camera}=f;
 for(const source of cloud.latest.values())source.delta=incoming.map(v=>v*.035);
 cloud.choose(true);const heads=cloud.heads.slice(),before=heads.map(xyz);cloud.advance(.01,camera);
 for(let i=0;i<heads.length;i++)close(xyz(heads[i]).map((v,k)=>(v-before[i][k])/.01),incoming,'Every initial head retains its own XYZ direction',.0001);
 for(let i=0;i<65;i++)step(f);
 cloud.release();while(cloud.active)step(f);
 const mask=cloud.ownershipMask(camera);assert.equal(mask.displaced,true);
 let checked=0;
 for(const p of heads){const owner=cloud.ownership.get(p.streamId),tile=(mask.rows.get(owner.row)||[]).findIndex(t=>t.key===p.cellOffset.join(','));
  if(tile<0){assert.equal(cloud.visible(p,camera),false,'Only offscreen copies may be culled');continue;}
  checked++;const j=(owner.row*mask.width+tile)*8;
  const shift=[0,1,2].map(k=>(mask.offsets[j+k]*256+mask.offsets[j+4+k]-32768)*mask.unit);
  close(xyz(p),xyz(owner.point).map((v,k)=>v+shift[k]),'GPU copy offset preserves the landing',mask.unit+.00001);
 }
 assert.ok(checked>0,'Visible returned copies reach the GPU');
 // A second launch must pick up exactly those independently landed copies.
 const positions=new Map(heads.map(p=>[p.streamId+':'+p.cellOffset.join(','),xyz(p)]));
 cloud.choose(true);
 for(const p of cloud.heads){const old=positions.get(p.streamId+':'+p.cellOffset.join(','));if(old)close(xyz(p),old,'Repeated launch begins at its returned copy position');}
}
console.log('PASS: six-axis entry momentum, packed GPU positions and repeated recorded return/entry continuity.');


// Original return restores all three axes and pairwise spacing without a new
// camera-facing distribution. Test flat, intermediate and rotating perspectives.
for(const [perspective,mode]of [[0,'fixed'],[.45,'fixed'],[1,'fixed'],[1,'gyroscope']]){
 const f=fixture(),{cloud,camera}=f;cloud.choose(true);
 for(let i=0;i<180;i++)step(f);
 camera.perspective=perspective;camera.setMode(mode);camera.prepareView();
 const heads=cloud.heads.slice(),homes=heads.map(p=>[...p.cloudState.home]),starts=heads.map(xyz),shape=heads.map(p=>[p.char,p.fontSize]);
 cloud.release();assert.deepEqual(heads.map(xyz),starts,'Release cannot teleport a head');
 let frames=0;while(cloud.active&&frames++<150)step(f);assert.ok(frames<150);
 for(let i=0;i<heads.length;i++){
  close(xyz(heads[i]),homes[i],'Recorded return restores the original world position',.01);
  assert.deepEqual([heads[i].char,heads[i].fontSize],shape[i],'Glyph identity and size survive');
  if(i)close(xyz(heads[i]).map((v,k)=>v-heads[0][['x','y','z'][k]]),homes[i].map((v,k)=>v-homes[0][k]),'Original pairwise depth and spacing',.01);
 }
}
console.log('PASS: approved original replay, same heads, original XYZ formation and no screen-facing replacement layout.');
