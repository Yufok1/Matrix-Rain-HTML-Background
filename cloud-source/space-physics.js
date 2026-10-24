/* A persistent atmosphere, not vacuum. Controls inject heat and momentum. */
(function(root){'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const CLOUDS=[[-4,-1,11,4.3],[4,1.6,18,5.2],[-5,2,28,6],[5,-2.4,35,6.7],[0,-1,23,4.7]];
class SpaceCamera{
 constructor(){this.resize(1280,720);this.update(0);}
 resize(w,h){this.width=w;this.height=h;this.focal=h*.92;}
 update(time){this.eye=[Math.sin(time*.11)*1.6,Math.sin(time*.071)*.75,Math.sin(time*.047)*.8];let x=-this.eye[0]/22,y=-this.eye[1]/22,z=1,n=Math.hypot(x,y,z);this.forward=[x/n,y/n,z/n];let r=Math.hypot(this.forward[0],this.forward[2]);this.right=[this.forward[2]/r,0,-this.forward[0]/r];let f=this.forward,a=this.right;this.up=[f[1]*a[2]-f[2]*a[1],f[2]*a[0]-f[0]*a[2],f[0]*a[1]-f[1]*a[0]];}
 project(p){let d=p.map((v,i)=>v-this.eye[i]),dot=v=>d.reduce((s,x,i)=>s+x*v[i],0),z=dot(this.forward);return{x:this.width*.5+dot(this.right)*this.focal/z,y:this.height*.5-dot(this.up)*this.focal/z,depth:z};}
 ray(x,y){let sx=(x-this.width*.5)/this.focal,sy=(this.height*.5-y)/this.focal;return this.forward.map((v,i)=>v+this.right[i]*sx+this.up[i]*sy);}
 atDepth(x,y,depth){let ray=this.ray(x,y),distance=depth/ray[2];return this.eye.map((v,i)=>v+ray[i]*distance);}
 ambientPoint(rand){return this.pick(this.width*(.12+rand()*.76),this.height*(.12+rand()*.76));}
 pick(x,y){let ray=this.ray(x,y),best=-Infinity,target=null;for(let z=6;z<=40;z+=.4){let p=this.eye.map((v,i)=>v+ray[i]*z),density=0;if(Math.abs(p[0])>13||Math.abs(p[1])>7||p[2]<4||p[2]>41)continue;for(let c of CLOUDS){let d=((p[0]-c[0])**2+(p[1]-c[1])**2+(p[2]-c[2])**2)/(c[3]*c[3]);density=Math.max(density,Math.exp(-d*1.3));}let score=density*(1-z*.006);if(score>best){best=score;target=p;}}
  if(!target)target=this.eye.map((v,i)=>v+ray[i]*6);
  return target.map((v,i)=>clamp(v,[-13,-7,4][i],[13,7,41][i]));
 }
}
class SpaceState{
 constructor(){this.time=0;this.phase='ready';this.rain=0;this.charge=0;this.phaseTime=0;this.strikes=[];this.trails=[];this.gusts=[];this.clicks=0;this.windEvents=0;this.storms=0;this.recoveries=0;this.coverage=0;this.peak=0;this.seed=723194;this.extent=0;this.cycleOrigin=[0,0,12];this.audioEnergy=0;this.traceCount=0;}
 rand(){let x=this.seed;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x;return(x>>>0)/4294967296;}
 strike(target,origin='manual'){if(this.strikes.length>=6)this.strikes.shift();this.strikes.push({target:[...target],origin,age:0,id:++this.clicks});if(this.phase==='ready'||(['deluge','clearing'].includes(this.phase)&&['press','click','keyboard','desktop-press','desktop-keyboard','wheel'].includes(origin))){this.phase='burning';this.phaseTime=0;this.extent=.015;this.cycleOrigin=[...target];this.charge=0;}}
 trace(from,to,strong=false){let distance=Math.hypot(...to.map((v,i)=>v-from[i]));if(distance<.04||distance>18)return;if(this.trails.length>=12)this.trails.shift();this.trails.push({from:[...from],to:[...to],radius:strong?.55:.10,gain:strong?1.8:.65,age:0,id:++this.traceCount});if(this.phase==='ready'){this.phase='burning';this.phaseTime=0;}}
 stir(from,to,seconds,strong){let velocity=to.map((v,i)=>(v-from[i])/Math.max(seconds,.02)),speed=Math.hypot(...velocity);if(speed<.1||speed>900)return;let max=strong?8:1.8,gain=strong?.48:.12,scale=Math.min(max,speed*gain)/speed;velocity=velocity.map(v=>v*scale);if(this.gusts.length>=8)this.gusts.shift();this.gusts.push({point:to.map((v,i)=>(v+from[i])*.5),force:velocity,radius:strong?3.6:2,age:0});this.windEvents++;}
 step(dt){this.time+=dt;this.phaseTime+=dt;for(let i=this.strikes.length-1;i>=0;i--){this.strikes[i].age+=dt;if(this.strikes[i].age>.8)this.strikes.splice(i,1);}for(let i=this.trails.length-1;i>=0;i--){this.trails[i].age+=dt;if(this.trails[i].age>.3)this.trails.splice(i,1);}for(let i=this.gusts.length-1;i>=0;i--){this.gusts[i].age+=dt;if(this.gusts[i].age>3)this.gusts.splice(i,1);}
  if(this.phase==='burning'){this.charge=Math.min(1,this.charge+dt*Math.max(0,this.coverage-.0005)*.8);this.extent+=dt*(.02+Math.max(0,this.audioEnergy)*.055+this.coverage*.12);}
  if(!this.continuousFire&&this.phase==='burning'&&this.extent>1.12){this.phase='deluge';this.phaseTime=0;this.storms++;}
  if(this.phase==='deluge'&&this.phaseTime>6&&this.coverage<.002){this.phase='clearing';this.phaseTime=0;}
  if(this.phase==='clearing'&&this.phaseTime>13){this.phase='ready';this.phaseTime=0;this.charge=0;this.extent=0;this.recoveries++;}
  let target=Math.max(this.phase==='deluge'?1:0,this.audioRain||0);this.rain+=(target-this.rain)*(1-Math.exp(-dt*(target>.5?.7:.24)));
 }
 measure(coverage){this.coverage=coverage;this.peak=Math.max(this.peak,coverage);}
}
class SpaceInput{
 constructor(camera,state,clock=()=>performance.now()/1000){this.camera=camera;this.state=state;this.clock=clock;this.lastKeyboard=-Infinity;this.lastPointer=-Infinity;this.previous=null;this.lastKind='none';}
 emit(point,kind){this.state.strike(point,kind);this.lastKind=kind;return true;}
 keyboard(kind='keyboard'){let now=this.clock();if(now-this.lastKeyboard<.30)return false;this.lastKeyboard=now;return this.emit(this.camera.ambientPoint(()=>this.state.rand()),kind);}
 point(x,y,kind='click',immediate=true){let now=this.clock();if(!immediate&&now-this.lastPointer<.65)return false;this.lastPointer=now;return this.emit(this.camera.pick(x,y),kind);}
 move(x,y,strong=false,kind='movement'){let now=this.clock(),old=this.previous;if(old&&now-old.time<.025)return false;let continuous=old&&now-old.time<.22,point=continuous?this.camera.atDepth(x,y,old.point[2]-this.camera.eye[2]):this.camera.pick(x,y);if(continuous){if(!strong)this.state.stir(old.point,point,now-old.time,strong);this.state.trace(old.point,point,strong);}this.previous={point,time:now};if(!strong&&now-this.lastPointer>=.65){this.lastPointer=now;this.emit(point,kind);}this.lastKind=kind;return true;}
 leave(){this.previous=null;}
}
const api={CLOUDS,SpaceCamera,SpaceState,SpaceInput};if(typeof module!=='undefined')module.exports=api;else root.ElementalSpace=api;
})(typeof window!=='undefined'?window:globalThis);
