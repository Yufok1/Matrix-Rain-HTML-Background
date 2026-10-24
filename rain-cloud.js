// Original rain trails fade untouched as their heads enter Cloud.
(function(root){
 'use strict';
 const state=root.rainCloud={amount:0,target:0,active:false,returning:false,gathering:false,prepareRequested:false,enterRequested:false,steps:0,maxSpeed:520,heads:[],entryDuration:2,launchLeadSeconds:.5,maxHeadHoldSeconds:0,headBudget:2400,latest:new Map()};
 const axes=['x','y','z'],clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
 const rgb=p=>p.rgb||rainCameraGPU.color(p.color);
 state.fade=function(age,length){
  const trails=root.matrixRainTrails,variety=trails?.enabled!==false,p=age/(variety?length:40);if(p>=1)return 0;
  return trails?.stepped!==false?[1,.68,.45,.29,.18,.105,.06,.032][Math.min(7,Math.floor(p*8))]:(variety?Math.exp(-4*p)*(1-p):Math.pow(.88,age));
 };
 state.speedScale=function(){return clamp(35/Math.max(4,Number(MatrixRainEngine.rainConfig.speed)||35),.15,4);};
 state.visible=function(p,camera){
  const r=camera.rotation,z0=p.z-500,x=r[0]*p.x+r[1]*p.y+r[2]*z0,y=r[3]*p.x+r[4]*p.y+r[5]*z0,z=r[6]*p.x+r[7]*p.y+r[8]*z0+500;
  if(z<=camera.near||z>=camera.far)return false;
  const scale=500/camera.projectionDepth(z),pad=Math.abs(p.fontSize*scale)*2;
  return Math.abs(x*scale)<matrixCanvas.width/2+pad&&Math.abs(y*scale)<matrixCanvas.height/2+pad;
 };
 state.addHome=function(source,camera,fresh=false){
  const stream=camera.streams.get(source.streamId),mark={...source,delta:[0,0,0]};
  const home={mark,offset:axes.map(k=>source[k]-(stream?.[k]??source[k])),copies:new Map(),fresh,tails:[],released:false};
  this.homes.set(source.streamId,home);return home;
 };
 state.ensureCopies=function(camera,initial=false){
  if(!initial&&(this.gathering||this.returning||this.heads.length>=this.limit))return;
  let added=0;
  for(const [id,home]of this.homes){
   const live=this.latest.get(id)||home.mark;
   if(!initial&&!this.enabled(live,camera))continue;
   home.mark.fontSize=Number(MatrixRainEngine.rainConfig.fontSize)||live.fontSize;
   for(const tile of this.ownershipTiles(camera)){
    if(!initial&&(this.heads.length>=this.limit||added>=24))return;
    const key=tile.offset.join(',');if(home.copies.has(key))continue;
    if(initial&&this.ownership&&!this.ownership.get(id)?.cells.has(key))continue;
    const shift=initial?this.ownership?.get(id)?.cells.get(key)?.shift:null;
    const p={...home.mark,x:home.mark.x+tile.offset[0]+(shift?.[0]||0),y:home.mark.y+tile.offset[1]+(shift?.[1]||0),z:home.mark.z+tile.offset[2]+(shift?.[2]||0),delta:[0,0,0],cellOffset:[...tile.offset],cloudInstance:true,cloudAge:0};
    if(!this.visible(p,camera))continue;
    p.cloudAlpha=home.mark.alpha;p.cloudRGB=[...rgb(home.mark)];
    const source=this.latest.get(id)||home.mark,seconds=Math.max(4,MatrixRainEngine.rainConfig.speed||35)/1000;
    const velocity=source.motionVelocity||source.delta.map(v=>v/seconds);
    const s=p.cloudState={vx:velocity[0],vy:velocity[1],vz:velocity[2],entryRGB:[...p.cloudRGB],entryAlpha:p.cloudAlpha,home:[p.x,p.y,p.z],unrecorded:!initial,tapeIndex:initial?this.heads.length:-1,entryStart:0,motionAge:0,entryVelocity:[...velocity]};
    // The departing head inherits its own world velocity, including counterflow
    // and crossflow branches; camera rotation does not change that vector.
    // Density/flow can introduce a new source. It visibly branches from an
    // existing head rather than materializing later as anonymous native rain.
    if(!initial&&this.heads.length){
     let parent=null,distance=Infinity;
     for(const other of this.heads){const d=(other.x-p.x)**2+(other.y-p.y)**2+(other.z-p.z)**2;if(d<distance){distance=d;parent=other;}}
     if(parent){for(const k of axes)p[k]=parent[k];s.parent=parent.streamId;s.birth=0;p.cloudAlpha=0;}
    }

    home.copies.set(key,p);this.heads.push(p);camera.marks.push(p);added++;
   }
  }
 };
 state.record=function(time){
  const points=new Float32Array(this.tapeSlots*3);
  for(const p of this.heads)if(!p.cloudState.unrecorded)for(let k=0;k<3;k++)points[p.cloudState.tapeIndex*3+k]=p[axes[k]];
  this.tape.push({time,points});
 };
 state.prepare=function(){
  if(!this.engine?.ready&&!this.error){this.prepareRequested=true;this.refresh?.();}
 };
 state.choose=function(on){
  if(root.rainSessionControls?.stopped)return;
  if(!on){this.enterRequested=false;this.release();this.refresh?.();return;}
  if(!this.engine?.ready){this.prepare();this.enterRequested=true;this.refresh?.();return;}
  this.enterRequested=false;
  if(this.active){this.returnRequested=false;if(this.returning){this.returning=false;this.sampleAge=1;for(const p of this.heads){const s=p.cloudState;s.entryVelocity=[s.vx,s.vy,s.vz];s.motionAge=0;}}this.refresh?.();return;}
  rainCamera.beginContinuousView();rainCamera.prepareView();
  const originals=rainCamera.marks.slice(),latest=new Map();
  for(const p of originals){const old=latest.get(p.streamId);if(!old||p.frame>=old.frame)latest.set(p.streamId,p);}
  // Include live sources whose latest head was culled or has no visible copy.
  for(const [id,p]of this.latest)if(rainCamera.frame-p.frame<=2)latest.set(id,p);
  this.homes=new Map();this.heads=[];this.gathering=true;this.gatherAge=0;this.waitingHeads=0;this.tape=[];
  const phase=root.matrixRainRendering?.smooth===false?1:(rainCameraGPU.stats.phase??1);
  for(const [id,source]of latest){
   const home=this.addHome(source,rainCamera);
   if(rainCamera.frame-1-source.frame<.5)for(let k=0;k<3;k++)home.mark[axes[k]]-=source.delta[k]*(1-phase);
   // Keep the native records byte-for-byte: positions, spacing, interpolation,
   // birth time, alpha and trail length all stay owned by the rain renderer.
   home.tails=originals.filter(p=>p.streamId===id&&p!==source);
  }
  const chosen=new Set(latest.values());rainCamera.marks=originals.filter(p=>!chosen.has(p));rainCamera.pending=[];
  this.ensureCopies(rainCamera,true);
  if(!this.heads.length){this.reset();return;}
  this.originalCount=originals.length;this.adopted=this.tapeSlots=this.heads.length;this.volume=rainCamera.volume;
  // Never discard an already visible head to meet a budget. Rotation may fill
  // the remaining slots, but cannot grow the population past this ceiling.
  this.limit=Math.max(this.adopted,this.headBudget);this.populationAge=0;
  this.anchor=[...rainCamera.rotation];this.engine?.setAnchor(this.anchor,rainCamera.volume);
  this.startedAt=performance.now();this.activeFrames=0;this.entryAge=this.recordAge=this.returnAge=this.returnDuration=this.lastReleaseAge=0;
  this.record(0);this.returnRequested=this.returning=false;this.target=this.amount=1;this.active=true;this.sampleAge=1;
  rainCamera.refreshCloudBounds();rainCameraGPU.invalidate=true;this.refresh?.();
 };
 state.capture=function(mark,camera){
  this.latest.set(mark.streamId,mark);
  if(camera.frame%120===0)for(const [id,p]of this.latest)if(camera.frame-p.frame>120&&!this.homes?.has(id))this.latest.delete(id);
  if(!this.active){this.trackOwnership(mark,camera);return false;}
  let home=this.homes.get(mark.streamId);
  if(!home)home=this.addHome(mark,camera,true);
  // Native simulation still supplies settings/audio, never a moving held head.
  return true;
 };
 state.advanceGather=function(dt,camera,phase){
  this.gatherAge+=dt;this.waitingHeads=0;
  const leadTicks=this.launchLeadSeconds*1000/Math.max(4,Number(MatrixRainEngine.rainConfig.speed)||35);
  for(const [id,home]of this.homes){
   if(home.released){for(const p of home.copies.values())this.moveHead(p,dt);continue;}
   // Zero hold: heads move on the first repaint after the click, even while
   // their original tails are bright. Tail records remain entirely native.
   const alive=this.maxHeadHoldSeconds>0&&home.tails.some(p=>p.alpha*this.fade(Math.max(0,camera.frame-1-p.frame)+leadTicks,p.trailLength)>=.003);
   if(alive&&home.copies.size&&this.gatherAge+1e-9<this.maxHeadHoldSeconds){this.waitingHeads+=home.copies.size;continue;}
   {
    const start=this.entryAge;
    home.released=true;this.lastReleaseAge=Math.max(this.lastReleaseAge,start);
    home.tails=[];
    for(const p of home.copies.values()){
     const s=p.cloudState;s.entryStart=start;
     // Do not replace the incoming rain velocity with the cloud sample.
     this.moveHead(p,dt);
    }
   }
  }
  if(!this.waitingHeads)this.gathering=false;
  this.recordMotion(dt);
  if(!this.gathering&&this.returnRequested){this.returnRequested=false;this.release();}
 };
 state.release=function(){
  if(!this.active||this.returning)return;
  if(this.gathering){this.returnRequested=true;this.refresh?.();return;}
  this.returning=true;this.returnAge=0;
  const last=this.tape[this.tape.length-1];
  this.returnDuration=Math.max(.05,...this.heads.filter(p=>!p.cloudState.unrecorded).map(p=>Math.min(this.entryDuration,last.time-p.cloudState.entryStart)));
  for(let i=0;i<this.heads.length;i++){
   const p=this.heads[i],s=p.cloudState;
   s.replayEnd=Math.min(last.time,s.entryStart+this.entryDuration);
   const [a,b,fraction]=this.bracket(s.replayEnd);
   s.returnOffset=axes.map((k,j)=>p[k]-this.pathPoint(s,s.replayEnd,a,b,fraction,j));
   s.returnRGB=[...p.cloudRGB];s.returnAlpha=p.cloudAlpha;
   s.returnStart=0;
  }
  this.refresh?.();
 };
 state.bracket=function(time){
  let lo=0,hi=this.tape.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(this.tape[mid].time<time)lo=mid+1;else hi=mid;}
  const a=this.tape[Math.max(0,lo-1)],b=this.tape[lo];return[a,b,b.time>a.time?clamp((time-a.time)/(b.time-a.time),0,1):0];
 };
 state.pathPoint=function(s,time,a,b,fraction,k){
  if(s.unrecorded||time<=s.entryStart)return s.home[k];
  const q=s.tapeIndex*3+k;
  if(a.time<s.entryStart)return s.home[k]+(b.points[q]-s.home[k])*(time-s.entryStart)/Math.max(.000001,b.time-s.entryStart);
  return a.points[q]+(b.points[q]-a.points[q])*fraction;
 };
 state.advanceReturn=function(dt,camera){
  this.returnAge=Math.min(this.returnDuration,this.returnAge+dt);
  const progress=this.returnAge/this.returnDuration,mix=smooth(progress),brackets=new Map();
  for(let i=0;i<this.heads.length;i++){
   const p=this.heads[i],s=p.cloudState,old=axes.map(k=>p[k]),source=this.latest.get(p.streamId)||p;
   const time=s.entryStart+(s.replayEnd-s.entryStart)*(1-progress);
   if(!brackets.has(time))brackets.set(time,this.bracket(time));
   const [a,b,fraction]=brackets.get(time);
   for(let k=0;k<3;k++){
    const path=this.pathPoint(s,time,a,b,fraction,k);
    const travel=smooth((this.returnAge-(s.returnStart||0))/Math.max(.001,this.returnDuration-(s.returnStart||0)));
    p[axes[k]]=path+s.returnOffset[k]*(1-travel);
    p.cloudRGB[k]=s.returnRGB[k]+(rgb(source)[k]-s.returnRGB[k])*mix;
   }
   s.vx=(p.x-old[0])/dt;s.vy=(p.y-old[1])/dt;s.vz=(p.z-old[2])/dt;
   p.cloudAlpha=s.returnAlpha+(this.enabled(p,camera)*source.alpha-s.returnAlpha)*mix;
  }
  if(progress>=1)this.finishReturn(camera);
 };
 state.finishReturn=function(camera){
  const native=[];this.returnedSources=0;this.orphanCopies=0;
  this.ownership=new Map();this.ownershipRows=new Map();this.freeRows=[];this.nextRow=1;
  // A returned tiled source may only draw copies that actually came back.
  // Other cells start new heads offscreen, never reveal a pre-existing tail.
  for(const [id,home]of this.homes){
   const source=this.latest.get(id)||home.mark,copy=home.copies.values().next().value;
   const mark={...home.mark,char:copy?.char||source.char,fontSize:copy?.fontSize||source.fontSize,frame:camera.frame-1,delta:[0,0,0],alpha:this.enabled(source,camera)*(copy?.cloudAlpha??source.alpha),rgb:[...(copy?.cloudRGB||rgb(source))]};
   if(copy){mark.x=camera.wrap(copy.x,camera.volume.x);mark.y=camera.wrap(copy.y,camera.volume.y);mark.z=camera.wrap(copy.z,camera.volume.z,camera.volume.zMin);}
   mark.motionVelocity=source.motionVelocity||source.delta.map(v=>v/(Math.max(4,Number(MatrixRainEngine.rainConfig.speed)||35)/1000));
   this.latest.set(id,mark);
   native.push(mark);this.returnedSources++;
   const owner=this.newOwner(id,mark,new Map([...home.copies].map(([key,p])=>[key,{offset:[...p.cellOffset],shift:axes.map((k,j)=>p[k]-mark[k]-p.cellOffset[j]),born:camera.frame-513,seen:camera.frame}])));
   mark.ownerRow=owner.row;
   const stream=camera.streams.get(id);
   if(stream){for(let k=0;k<3;k++)stream[axes[k]]=mark[axes[k]]-home.offset[k];stream.delta=[0,0,0];stream.frame=camera.frame-1;}
  }
  camera.marks=camera.marks.filter(p=>!p.cloudInstance&&!p.gatherTail).concat(native);camera.pending=[];
  for(const p of camera.marks)p.ownerRow=this.ownership.get(p.streamId)?.row||0;
  this.heads=[];this.tape=[];this.active=this.returning=this.gathering=false;this.amount=this.target=0;
  camera.refreshCloudBounds();rainCameraGPU.invalidate=true;this.refresh?.();
 };
 state.newOwner=function(id,point,cells=new Map()){
  this.maskCache=null;
  const owner={id,row:this.freeRows.pop()??this.nextRow++,point,cells};
  this.ownership.set(id,owner);this.ownershipRows.set(owner.row,owner);return owner;
 };
 state.trackOwnership=function(mark,camera){
  if(!this.ownership)return;
  let owner=this.ownership.get(mark.streamId);
  if(!owner)owner=this.newOwner(mark.streamId,mark);
  else{
   const spans=[camera.volume.x,camera.volume.y,camera.volume.z];
   const shift=axes.map((k,j)=>Math.round((owner.point[k]+mark.delta[j]-mark[k])/spans[j])*spans[j]);
   if(shift.some(Boolean)){
    const cells=new Map();for(const item of owner.cells.values()){
     const offset=item.offset.map((x,j)=>x+shift[j]);cells.set(offset.join(','),{...item,offset});
    }
    // History keeps its old row/cells. Only births after this seam use the
    // shifted row, so wrapping never teleports the existing trail.
    owner=this.newOwner(mark.streamId,mark,cells);
   }
   owner.point=mark;
  }
  mark.ownerRow=owner.row;
 };
 state.ownershipTiles=function(camera){
  if(!this.ownershipRows)return camera.tiles;
  // Logical copies can now occupy different positions inside the volume.
  // Keep their draw slots available even when the original cell left view.
  const tiles=new Map(camera.tiles.map(t=>[t.offset.join(','),t]));
  for(const owner of this.ownershipRows.values())for(const [key,item]of owner.cells)if(camera.frame-item.seen<=160&&!tiles.has(key))tiles.set(key,{offset:item.offset,depth:0});
  return [...tiles.values()];
 };
 state.ownershipMask=function(camera){
  if(!this.ownership)return null;
  // Native records/copy ownership change at the simulation tick, not at every
  // display repaint. The glyph padding covers the intervening camera motion.
  if(this.maskCache?.frame===camera.frame)return this.maskCache.mask;
  if(!this.active&&camera.frame%60===0){
   for(const [row,owner]of this.ownershipRows)if(camera.frame-owner.point.frame>160){
    this.ownershipRows.delete(row);this.freeRows.push(row);
    if(this.ownership.get(owner.id)===owner)this.ownership.delete(owner.id);
   }
  }
  // Each row packs only its own visible copies. Global tile labels used to
  // multiply every source by hundreds of unrelated copies after cloud returns.
  const bounds=new Map(),rows=new Map();let width=1,maximum=0;
  for(const p of camera.marks){if(p.cloudInstance||!p.ownerRow)continue;let b=bounds.get(p.ownerRow);
   if(!b){b={lo:[Infinity,Infinity,Infinity],hi:[-Infinity,-Infinity,-Infinity],pad:0};bounds.set(p.ownerRow,b);}
   for(let k=0;k<3;k++){b.lo[k]=Math.min(b.lo[k],p[axes[k]],p[axes[k]]-p.delta[k]);b.hi[k]=Math.max(b.hi[k],p[axes[k]],p[axes[k]]-p.delta[k]);}b.pad=Math.max(b.pad,p.fontSize*1.6);
  }
  for(const [row,owner]of this.ownershipRows)if(!bounds.has(row)&&this.ownership.get(owner.id)!==owner){this.ownershipRows.delete(row);this.freeRows.push(row);}
  const r=camera.rotation,mix=camera.continuous?camera.perspective:1,sx=matrixCanvas.width/1000,sy=matrixCanvas.height/1000;
  const planes=[[1,0,sx*mix,matrixCanvas.width/2*(1-mix)],[-1,0,sx*mix,matrixCanvas.width/2*(1-mix)],[0,1,sy*mix,matrixCanvas.height/2*(1-mix)],[0,-1,sy*mix,matrixCanvas.height/2*(1-mix)],[0,0,1,-camera.near],[0,0,-1,camera.far]].map(([a,b,c,d])=>[a*r[0]+b*r[3]+c*r[6],a*r[1]+b*r[4]+c*r[7],a*r[2]+b*r[5]+c*r[8],c*500+d,Math.abs(a)+Math.abs(b)]);
  for(const owner of this.ownershipRows.values()){
   const p=owner.point,b=bounds.get(owner.row);if(!b)continue;
   if(!this.active&&this.ownership.get(owner.id)===owner)for(const tile of camera.tiles){const offset=tile.offset,key=offset.join(',');
    if(!owner.cells.has(key)&&!this.visible({x:p.x+offset[0],y:p.y+offset[1],z:p.z+offset[2],fontSize:p.fontSize},camera))owner.cells.set(key,{offset:[...offset],born:camera.frame,seen:camera.frame});
   }
   const center=b.lo.map((v,k)=>(v+b.hi[k])*.5),half=b.lo.map((v,k)=>(b.hi[k]-v)*.5),padding=b.pad+35;
   const rowPlanes=planes.map(([x,y,z,d,pad])=>[x,y,z,x*center[0]+y*center[1]+z*(center[2]-500)+d+Math.abs(x)*half[0]+Math.abs(y)*half[1]+Math.abs(z)*half[2]+padding*pad]),list=[];
   for(const [key,item]of owner.cells){const offset=item.offset.map((v,k)=>v+(item.shift?.[k]||0));
    let visible=true;for(const plane of rowPlanes)if(plane[0]*offset[0]+plane[1]*offset[1]+plane[2]*offset[2]+plane[3]<0){visible=false;break;}
    if(visible){item.seen=camera.frame;list.push({key,item,offset});maximum=Math.max(maximum,...offset.map(Math.abs));}
    else if(camera.frame-item.seen>160)owner.cells.delete(key);
   }
   rows.set(owner.row,list);width=Math.max(width,list.length);
  }
  const height=this.nextRow,data=new Uint8Array(width*height*4),offsets=new Uint8Array(width*height*8),unit=Math.max(1/1024,maximum/32760);
  for(const [row,list]of rows)for(let i=0;i<list.length;i++){
    const {item,offset}=list[i],j=(row*width+i)*4,born=((item.born%4096)+4096)%4096;
    data[j]=255;data[j+1]=born%256;data[j+2]=Math.floor(born/256);data[j+3]=camera.frame-item.born>512?0:255;
    for(let k=0;k<3;k++){const packed=32768+Math.round(offset[k]/unit),q=j*2+k;offsets[q]=packed>>8;offsets[q+4]=packed&255;}
  }
  const mask={width,height,data,offsets,unit,displaced:true,packed:true,rows,tiles:Array.from({length:width},()=>({offset:[0,0,0]}))};
  this.maskCache={frame:camera.frame,view:camera._viewState,mask};return mask;
 };
 state.copyVisible=function(p,item,camera){
  const shift=item.shift||[0,0,0],r=camera.rotation,x=p.x+item.offset[0]+shift[0],y=p.y+item.offset[1]+shift[1],z=p.z+item.offset[2]+shift[2]-500;
  const vx=r[0]*x+r[1]*y+r[2]*z,vy=r[3]*x+r[4]*y+r[5]*z,vz=r[6]*x+r[7]*y+r[8]*z+500;
  const margin=Math.hypot(...p.delta)*(p.trailLength||40)+p.fontSize*2;
  if(vz+margin<camera.near||vz-margin>camera.far)return false;
  const depth=camera.projectionDepth(Math.max(camera.near,vz+margin));
  return Math.abs(vx)-margin<matrixCanvas.width*depth/1000&&Math.abs(vy)-margin<matrixCanvas.height*depth/1000;
 };
 state.prune=function(camera){
  const removed=new Set();
  for(const p of this.heads)if(!this.enabled(p,camera)&&p.cloudAlpha<.003){
   removed.add(p);this.homes.get(p.streamId)?.copies.delete(p.cellOffset.join(','));
  }
  if(removed.size){this.heads=this.heads.filter(p=>!removed.has(p));camera.marks=camera.marks.filter(p=>!removed.has(p));}
  for(const [id,home]of this.homes)if(!home.copies.size&&!this.enabled(home.mark,camera)){this.homes.delete(id);this.latest.delete(id);}
 };
 state.enabled=function(p,camera){
  const id=p.appearanceId??p.streamId,source=this.latest.get(p.streamId);
  if(root.activeColumnsMask&&Number.isInteger(id)&&root.activeColumnsMask[id]===false)return 0;
  return source&&camera.frame-source.frame>40?0:1;
 };
 state.appearance=function(dt,camera){
  const follow=1-Math.exp(-dt*12),detail=smooth((this.entryAge-1)/1.5),config=MatrixRainEngine.rainConfig;
  const intensity=clamp((Number(config.intensity)||70)/70,.15,1.4);
  for(const p of this.heads){
   const source=this.latest.get(p.streamId)||p,s=p.cloudState;
   p.char=source.char;p.fontSize=Number(config.fontSize)||source.fontSize;p.trailLength=source.trailLength;
   const target=rgb(source),shade=1-detail*(1-(s.shade??1)),birth=s.birth===undefined?1:smooth(s.birth/.35);
   if(s.birth!==undefined)s.birth+=dt;
   if(!this.returning){
    for(let k=0;k<3;k++)p.cloudRGB[k]+=(target[k]*shade-p.cloudRGB[k])*follow;
    const alpha=source.alpha*this.enabled(p,camera)*intensity*birth;
    p.cloudAlpha+=(alpha-p.cloudAlpha)*follow;
   }
  }
 };
 state.sample=function(dt,camera){
  this.sampleAge=(this.sampleAge||0)+dt;
  if(this.sampleAge<.12)return;
  const start=performance.now(),rate=this.speedScale(),sampling=this.heads.filter(p=>this.enabled(p,camera));
  if(this.engine.sample(sampling,camera.volume)){
   this.sampleAge=0;
   for(let i=0;i<sampling.length;i++){
    const s=sampling[i].cloudState,j=i*4;
    s.tx=this.engine.flow[j]*rate;s.ty=this.engine.flow[j+1]*rate;s.tz=this.engine.flow[j+2]*rate;
    const speed=Math.hypot(s.tx,s.ty,s.tz),scale=Math.min(1,this.maxSpeed*rate/Math.max(speed,.001));s.tx*=scale;s.ty*=scale;s.tz*=scale;
    s.shade=.7+.3*clamp(Math.max(this.engine.colors[j],this.engine.colors[j+1],this.engine.colors[j+2]),0,1);
   }
  }
  this.sampleMs=performance.now()-start;
 };
 state.blendVelocity=function(a,b,t){
  const sa=Math.hypot(...a),sb=Math.hypot(...b);if(sa<.00001||sb<.00001)return a.map((v,k)=>v+(b[k]-v)*t);
  const u=a.map(v=>v/sa),v=b.map(v=>v/sb),dot=clamp(u.reduce((sum,x,k)=>sum+x*v[k],0),-1,1),speed=sa+(sb-sa)*t;
  if(dot>.9995)return u.map((x,k)=>(x+(v[k]-x)*t)*speed);
  let tangent=v.map((x,k)=>x-dot*u[k]),length=Math.hypot(...tangent);
  if(length<.0001){const axis=u.map(Math.abs).indexOf(Math.min(...u.map(Math.abs)));tangent=u.map((x,k)=>(k===axis?1:0)-u[axis]*x);length=Math.hypot(...tangent);}
  const angle=Math.acos(dot)*t;return u.map((x,k)=>(x*Math.cos(angle)+tangent[k]/length*Math.sin(angle))*speed);
 };
 state.moveHead=function(p,dt){
  if(!(dt>0))return;
  const rate=this.speedScale(),follow=1-Math.exp(-dt*9*rate),s=p.cloudState,source=this.latest.get(p.streamId),delta=source?.delta||[0,0,0],length=Math.hypot(...delta)||1;
  if(s.tx!==undefined){
   const drift=this.maxSpeed*rate*.07,target=[s.tx+delta[0]/length*drift,s.ty+delta[1]/length*drift,s.tz+delta[2]/length*drift];
   if(s.motionAge<.8){[s.vx,s.vy,s.vz]=this.blendVelocity(s.entryVelocity,target,smooth(s.motionAge/.8));}
   else{s.vx+=(target[0]-s.vx)*follow;s.vy+=(target[1]-s.vy)*follow;s.vz+=(target[2]-s.vz)*follow;}
  }
  p.x+=s.vx*dt;p.y+=s.vy*dt;p.z+=s.vz*dt;s.motionAge+=dt;
 };
 state.recordMotion=function(dt){
  this.entryAge+=dt;
  if(this.gathering||this.recordAge<this.lastReleaseAge+this.entryDuration){this.recordAge=this.entryAge;this.record(this.recordAge);}
 };
 state.move=function(dt){
  for(const p of this.heads)this.moveHead(p,dt);this.recordMotion(dt);
 };
 state.advance=function(dt,camera,phase=1){
  if(!(dt>0)||!camera.volume||this.error)return;
  // The default rain view must not allocate/compile a second GPU renderer.
  // A remembered opt-in alone does not start it; Auto must actually be running.
  if(!this.engine?.ready&&typeof autoOrchestratorActive!=='undefined'&&autoOrchestratorActive&&root.rainAutoScenes?.includeCloud)this.prepareRequested=true;
  if(!this.active&&!this.prepareRequested)return;
  const start=performance.now();dt=Math.min(.05,dt);
  try{
   if(this.active&&this.volume!==camera.volume){this.reset();return;}
   if(!this.engine){this.engine=new root.OmniCloud();if(this.anchor)this.engine.setAnchor(this.anchor,camera.volume);}
   const rate=this.speedScale();
   if((this.active&&!this.returning)||!this.engine.ready)this.engine.step(dt*rate,camera.volume);
   if(this.engine.ready&&this.prepareRequested){
    this.prepareRequested=false;
    if(this.enterRequested)this.choose(true);
    this.refresh?.();
   }
   if(this.active){
    camera.prepareView();
    if(!this.returning)this.sample(dt,camera);
    if(this.gathering)this.advanceGather(dt,camera,phase);
    else if(this.returning)this.advanceReturn(dt,camera);
    else{
     this.appearance(dt,camera);this.move(dt);
     this.populationAge+=dt;
     if(this.populationAge>=.25){this.populationAge=0;this.prune(camera);this.ensureCopies(camera);}
    }
    camera.refreshCloudBounds();rainCameraGPU.invalidate=true;this.steps++;this.activeFrames++;
   }
  }catch(error){this.error=String(error);console.error('Cloud handoff:',error);}
  this.cpuMs=performance.now()-start;this.cpuAverage=(this.cpuAverage||0)*.96+this.cpuMs*.04;
  this.frameTimes??=[];this.frameTimes.push(start);while(this.frameTimes.length>1&&start-this.frameTimes[0]>3000)this.frameTimes.shift();
  this.fps=(this.frameTimes.length-1)*1000/Math.max(1,start-this.frameTimes[0]);
  if(start-(this.lastRefresh||0)>150){this.lastRefresh=start;this.refresh?.();}
 };
 state.reset=function(){
  this.active=this.returning=this.gathering=this.prepareRequested=this.enterRequested=false;this.heads=[];this.tape=[];this.homes=null;this.latest.clear();this.ownership=this.ownershipRows=null;this.amount=this.target=0;this.error=null;
  rainCamera.cloudUntiled=false;
 };
 state.mount=function(parent){
  const field=document.createElement('div');field.id='rain-cloud-controls';field.className='control-item';
  field.innerHTML='<button id="rain-cloud-toggle" type="button" aria-pressed="false">Transform into Cloud</button><small style="display:block;margin-top:6px"></small>';
  const button=field.querySelector('button'),status=field.querySelector('small');button.onclick=()=>state.choose(!state.enterRequested&&(state.returning||state.returnRequested||!state.active));
  state.refresh=()=>{
   button.textContent=state.enterRequested?'Cancel cloud preparation':state.returning||state.returnRequested?'Return to cloud':state.active?'Return to rain':'Transform into Cloud';button.setAttribute('aria-pressed',String(state.active));
   status.textContent=state.error||(state.gathering?'Original trails fading':state.returning?'Returning the same heads to rain':state.active?'Cloud · your rain palette and controls':state.engine?.ready?'Rain — Cloud ready':state.prepareRequested?'Preparing Cloud — rain continues':'Rain — cloud starts on request');
   Object.assign(field.dataset,{amount:String(state.amount),frame:String(rainCamera.frame),marks:String(rainCamera.marks.length),heads:String(state.heads.length),nativeTails:String(rainCamera.marks.filter(p=>!p.cloudInstance).length),sources:String(state.homes?.size||0),returnedSources:String(state.returnedSources||0),orphanCopies:String(state.orphanCopies||0),gathering:String(state.gathering),gatherProgress:(state.heads.length?1-state.waitingHeads/state.heads.length:0).toFixed(3),initialMarks:String(state.originalCount||0),adopted:String(state.adopted||0),headLimit:String(state.limit||state.headBudget),steps:String(state.steps),cpuMs:(state.cpuMs||0).toFixed(2),cpuAverage:(state.cpuAverage||0).toFixed(2),sampleMs:(state.sampleMs||0).toFixed(2),fps:(state.fps||0).toFixed(1),candidates:String(state.engine?.candidates?.length||0),active:String(state.active),ready:String(!!state.engine?.ready),queries:String(state.engine?.queries||0),entryAge:(state.entryAge||0).toFixed(2),speedScale:state.speedScale().toFixed(3),fontSize:String(MatrixRainEngine.rainConfig.fontSize),palette:'rain',returning:String(state.returning),returnProgress:(state.returnAge/Math.max(.05,state.returnDuration)||0).toFixed(3),returnSeconds:String(state.returnDuration||0),error:state.error||''});
  };parent.prepend(field);state.refresh();
 };
})(window);
