/* One spatial field. A roll carries a connected train of finite fire blasts. */
(function(root){'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const unit=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
class FireMotion{
 constructor(){
  this.position=[-5,-1,20];this.heading=unit([1,.3,.7]);this.speed=12;
  this.blasts=[];this.serial=0;this.seenStrike=0;this.seenTrace=0;
  this.onset=0;this.turns=0;this.reversals=0;this.distance=10;this.age=0;
  this.hue=0;this.lastManual=-10;this.lastBurst=-10;this.runners=[];this.lastFork=0;this.gestureDistance=0;
  this.a=new Float32Array(80);this.b=new Float32Array(80);this.c=new Float32Array(80);
  this.fronts=[];this.frontSerial=0;this.lastFront=-10;this.pendingTurn=null;this.darkFor=0;this.renewals=0;
  this.frontA=new Float32Array(16);this.frontB=new Float32Array(16);this.frontC=new Float32Array(16);
  this.values={blastA:this.a,blastB:this.b,blastC:this.c};
 }
 steer(direction,force=1){
  const next=unit(direction),alignment=dot(next,this.heading);
  if(alignment<-.25)this.reversals++;
  this.heading=unit(this.heading.map((x,i)=>x*(1-force)+next[i]*force));
  this.turns++;
 }
 burst(point,strength=1,kind='roll',heading=this.heading){
  this.blasts.push({point:[...point],heading:[...heading],age:0,strength,hue:this.hue,id:++this.serial,kind});if(kind!=='branch')this.lastBurst=this.age;
  if(this.blasts.length>20)this.blasts.shift();
  const interval=kind==='audio'?1.2:kind==='drag'?.9:1.7;
  if(kind==='click'||this.age-this.lastFront>interval)this.unfurl(point,heading,strength,kind);
 }
 unfurl(point,heading,strength,kind){
  const id=++this.frontSerial;
  const automatic=!['click','drag','reversal'].includes(kind),z=Math.max(6,point[2]);
  const inward=[point[0]/(z*.49*(this.aspect||1.7778)),point[1]/(z*.49),(point[2]-27)/24];
  const axis=unit(heading.map((x,i)=>x-(automatic?inward[i]*.8:0)));
  this.fronts.push({point:[...point],heading:axis,age:-.10,strength:clamp(strength,.7,1.5),hue:this.hue,scale:clamp(Math.sqrt(point[2]/18),.65,1.7),spin:(id%2?1:-1)*(.6+strength*.35),id,kind});
  if(this.fronts.length>4)this.fronts.shift();this.lastFront=this.age;
 }
 fork(a){
  const n=this.serial,side=n%2?1:-1,axis=this.heading;
  const heading=unit([-axis[1]*side+.3*a.pan,axis[0]*side*.7,side*(.8+a.width)]);
  this.runners.push({position:[...this.position],heading,age:0,distance:0,phase:n*.7,hue:(this.hue+side*1.35+6)%6,last:0});
  if(this.runners.length>2)this.runners.shift();this.lastFork=this.age;
 }
 step(dt,envelope,state,camera,visibility=1){
  this.age+=dt;this.aspect=camera.width/camera.height;const a=envelope.value;
  for(const blast of this.blasts)blast.age+=dt;
  this.blasts=this.blasts.filter(b=>b.age<1.65);
  for(const front of this.fronts)front.age+=dt;
  this.fronts=this.fronts.filter(f=>f.age<4.6);
  const strikes=state.strikes.filter(s=>s.id>this.seenStrike);
  for(const strike of strikes){
   this.seenStrike=strike.id;if(strike.origin==='audio')continue;
   if(!['press','click','desktop-press'].includes(strike.origin))continue;
   this.hue=(this.hue+1.7)%6;this.lastManual=this.age;this.pendingTurn=null;
   this.position=[...strike.target];this.distance=0;
   this.burst(strike.target,1.6,'click');
  }
  for(const trace of state.trails.filter(t=>t.id>this.seenTrace)){
   this.seenTrace=trace.id;if(trace.gain<=1)continue;
   const delta=trace.to.map((x,i)=>x-trace.from[i]),length=Math.hypot(...delta);
   // Direction, including a reversal, follows the held gesture immediately.
   const old=this.heading,turn=old[0]*delta[1]-old[1]*delta[0];
   const reversals=this.reversals;
   this.steer([delta[0],delta[1],clamp(turn*1.8,-length,length)],1);
   const youngest=this.fronts.at(-1);
   if(youngest&&youngest.kind==='click'&&!youngest.steered&&youngest.age<.35){youngest.heading=[...this.heading];youngest.steered=true;}
   if(this.reversals>reversals)this.pendingTurn={point:[...trace.to],heading:[...this.heading]};
   this.position=[...trace.to];this.lastManual=this.age;
   this.gestureDistance+=length;
   if(this.gestureDistance>Math.max(.7,trace.to[2]*.065)){
    this.burst(trace.to,1.1,'drag');this.gestureDistance=0;
   }
   this.distance=0;
  }
  if(this.pendingTurn&&this.age-this.lastFront>.12){this.unfurl(this.pendingTurn.point,this.pendingTurn.heading,1.15,'reversal');this.pendingTurn=null;}
  if(envelope.onsets!==this.onset){
   this.onset=envelope.onsets;
   if(this.age-this.lastManual>.65){
    const angle=this.onset*2.399+a.centroid*3.2+a.pan*2;
    const depth=clamp(Math.sin(this.onset*1.12+a.width*2)*1.2+(a.high-a.low)*.3,-1.2,1.2);
    this.steer([Math.cos(angle),Math.sin(angle)*.7,depth],.82);
    this.speed=12+a.level*18+a.transient*12;
    this.hue=(a.centroid*4+a.high*2+this.onset*.67)%6;
    if(this.age-this.lastBurst>.16)this.burst(this.position,1.05+a.transient*.65,'audio');
    this.distance=0;
   }
  }
  // Momentum survives a roll, but a blast never does. This baseline advances
  // independently of audio; silence does not fabricate onset measurements.
  const manual=this.age-this.lastManual<.16;
  if(!manual){
   if(this.age-this.lastManual>.65){
    const z=Math.max(6,this.position[2]),inward=[-this.position[0]/(z*.49*this.aspect),-this.position[1]/(z*.49),(27-z)/24];
    this.heading=unit(this.heading.map((x,i)=>x+inward[i]*dt*.75));
   }
   this.speed+=(10+a.level*14-this.speed)*(1-Math.exp(-dt*1.6));
   const roll=this.age*(2+a.mid*3),axis=this.heading;
   const side=unit([-axis[1],axis[0],.18]);
   const travel=axis.map((x,i)=>(x+side[i]*Math.sin(roll)*.36)*this.speed*dt);
   this.position=this.position.map((x,i)=>x+travel[i]);this.distance+=Math.hypot(...travel);
   const depth=clamp(this.position[2],6,53),limitY=depth*.49,limitX=limitY*camera.width/camera.height;
   for(const [i,limit]of [[0,limitX],[1,limitY]])if(Math.abs(this.position[i])>limit){this.position[i]=clamp(this.position[i],-limit,limit);this.heading[i]=-Math.sign(this.position[i])*Math.abs(this.heading[i]||.35);this.turns++;}
   if(this.position[2]<6||this.position[2]>53){this.position[2]=depth;this.heading[2]=this.position[2]===6?Math.abs(this.heading[2]||.6):-Math.abs(this.heading[2]||.6);this.turns++;}
   this.heading=unit(this.heading);
   const spacing=Math.max(1.1,this.position[2]*.075);
   if(this.distance>spacing&&this.age-this.lastBurst>.24){this.hue=(this.hue+.13+a.flux*.3)%6;this.burst(this.position,.9+a.level*.55,'roll');this.distance=0;}
  }
  // A concussion can launch another roll from its own position. These are
  // causal branches with independent trajectories, never copies of the scene.
  if(this.age-this.lastFork>1.4&&this.age-this.lastManual>.7)this.fork(a);
  for(const runner of this.runners){
   runner.age+=dt;const speed=17+a.level*16;
   const side=unit([-runner.heading[1],runner.heading[0],.15]);
   const travel=runner.heading.map((x,i)=>(x+side[i]*Math.sin(runner.phase+runner.age*6)*.48)*speed*dt);
   runner.position=runner.position.map((x,i)=>x+travel[i]);runner.distance+=Math.hypot(...travel);
   const p=runner.position,z=clamp(p[2],6,53),ly=z*.49,lx=ly*camera.width/camera.height;
   for(const [i,limit]of [[0,lx],[1,ly]])if(Math.abs(p[i])>limit){p[i]=clamp(p[i],-limit,limit);runner.heading[i]*=-1;}
   if(p[2]<6||p[2]>53){p[2]=z;runner.heading[2]*=-1;}
   if(runner.distance>Math.max(1.4,z*.075)&&runner.age-runner.last>.26){
    const hue=this.hue;this.hue=(runner.hue+runner.age*.4)%6;
    this.burst(p,1.1+a.level*.35,'branch',runner.heading);this.hue=hue;
    runner.distance=0;runner.last=runner.age;
   }
  }
  this.runners=this.runners.filter(r=>r.age<2.65);
  this.darkFor=visibility<.055&&this.age-this.lastManual>.8?this.darkFor+dt:0;
  if(this.darkFor>1.15){
   const point=camera.atDepth(camera.width*(.5+a.pan*.14),camera.height*(.40+a.centroid*.20),12+a.centroid*28);
   this.position=[...point];this.hue=(this.hue+1.1)%6;
   this.burst(point,1.15,'renewal');
   if(this.age-this.lastFront>.05)this.unfurl(point,this.heading,1.15,'renewal');
   this.darkFor=0;this.renewals++;
  }
  this.a.fill(0);this.b.fill(0);this.c.fill(0);
  this.blasts.forEach((b,i)=>{
   this.a.set([...b.point,b.age],i*4);
   this.b.set([...b.heading,b.strength],i*4);
   this.c.set([b.hue,b.id,b.kind==='drag'?.65:1,['click','drag'].includes(b.kind)?1:0],i*4);
  });
  this.frontA.fill(0);this.frontB.fill(0);this.frontC.fill(0);
  this.fronts.forEach((f,i)=>{this.frontA.set([...f.point,f.age],i*4);this.frontB.set([...f.heading,f.strength],i*4);this.frontC.set([f.scale,f.hue,f.id,f.spin],i*4);});
  this.values={blastA:this.a,blastB:this.b,blastC:this.c,foldA:this.frontA,foldB:this.frontB,foldC:this.frontC,rollColor:[this.hue,...this.heading],viewAspect:camera.width/camera.height};
  return this.values;
 }
}
const api={FireMotion};if(typeof module!=='undefined')module.exports=api;else root.ElementalMotion=api;
})(typeof window!=='undefined'?window:globalThis);
