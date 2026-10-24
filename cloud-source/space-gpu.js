/* WebGL2 open-boundary volume: momentum, pressure, fuel, heat and water. */
(function(root){'use strict';
const NX=80,NY=48,NZ=64,TW=NX*8,TH=NY*8;
const common=`
precision highp float;precision highp int;
const ivec3 N=ivec3(${NX},${NY},${NZ});const vec3 size=vec3(28.,16.,56.),origin=vec3(-14.,-8.,3.);
const vec3 cell=size/vec3(N);const vec2 atlasSize=vec2(${TW}.,${TH}.);
uniform float viewAspect;
float aspect(){return viewAspect>.1?viewAspect:1.7777778;}
// A single camera-shaped volume: distant space is wider, never tiled.
vec3 gridWorld(vec3 p){vec3 w=origin+p*cell;w.xy*=w.z/14.*vec2(aspect()/1.75,1.);return w;}
vec3 gridAt(vec3 w){vec3 q=w;q.xy/=max(w.z,1.)/14.*vec2(aspect()/1.75,1.);return(q-origin)/cell;}
vec3 metric(ivec3 p){float z=origin.z+float(p.z)*cell.z;return cell*vec3(z/14.*aspect()/1.75,z/14.,1.);}
uniform sampler2D velocity,chem,humidity,pressure,divergence,flame,history,surfaceDepth;
uniform float dt,time,rain,feed,audio;
uniform vec4 bolts[6],gustPoint[8],gustForce[8],clouds[5];
uniform vec4 wakeA[12],wakeB[12];
uniform vec4 blastA[20],blastB[20],blastC[20],rollColor;
uniform vec4 foldA[4],foldB[4],foldC[4];
uniform vec4 audioDrive,audioSpatial,musicControl,cycleControl,cycleOrigin,sceneControl,interactionA[64],interactionB[64],musicSources[6],musicFlow[6],musicWaves[4],musicWaveForce[4],musicBands[12],musicMemory[12],cosmicFront[8],cosmicPower[8],heatFlashes[6],heatFlashPower[6];
float musicBand(int i){return musicBands[i/4][i%4];}
float rememberedBand(int i){return musicMemory[i/4][i%4];}
vec3 spectrumColor(int group){
 if(group==0)return vec3(1.,.12,.055);
 if(group==1)return vec3(1.,.43,.045);
 if(group==2)return vec3(1.,.075,.39);
 if(group==3)return vec3(.46,.18,1.);
 if(group==4)return vec3(.045,.46,1.);
 return vec3(.055,1.,.68);
}
vec3 spectralHue(float hue){float h=mod(hue,6.);int i=int(floor(h));return mix(spectrumColor(i),spectrumColor((i+1)%6),smoothstep(0.,1.,fract(h)));}
// Diffuse cloud light. No geometry, screen-wide exposure flash or strobe train.
vec3 heatLight(vec3 pos,float lingering){
 vec3 light=vec3(0.);
 for(int i=0;i<6;i++){
  float age=heatFlashes[i].w,envelope=(1.-exp(-age*28.))*exp(-age*mix(5.,.85,lingering));
  vec3 d=(pos-heatFlashes[i].xyz)/vec3(47.,32.,65.);
  light+=heatFlashPower[i].rgb*heatFlashPower[i].w*envelope*exp(-dot(d,d)*.85);
 }
 return min(light,vec3(1.1));
}
#ifdef FRAGMENT_SCOPE
ivec3 coord(){ivec2 p=ivec2(gl_FragCoord.xy);return ivec3(p.x%N.x,p.y%N.y,p.x/N.x+(p.y/N.y)*8);}
#endif
bool outside(ivec3 p){return any(lessThan(p,ivec3(0)))||any(greaterThanEqual(p,N));}
vec2 texcoord(ivec3 p){return(vec2((p.z%8)*N.x+p.x,(p.z/8)*N.y+p.y)+.5)/atlasSize;}
vec4 fetch(sampler2D field,ivec3 p){return outside(p)?vec4(0.):texture(field,texcoord(p));}
vec4 sample3(sampler2D field,vec3 p){if(any(lessThan(p,vec3(0.)))||any(greaterThan(p,vec3(N-1))))return vec4(0.);float z=floor(p.z),b=fract(p.z);vec2 a=(vec2(mod(z,8.)*float(N.x),floor(z/8.)*float(N.y))+p.xy+.5)/atlasSize;float zz=min(z+1.,float(N.z-1));vec2 c=(vec2(mod(zz,8.)*float(N.x),floor(zz/8.)*float(N.y))+p.xy+.5)/atlasSize;return mix(texture(field,a),texture(field,c),b);}
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise(vec3 p){vec3 a=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(a),hash(a+vec3(1,0,0)),f.x),mix(hash(a+vec3(0,1,0)),hash(a+vec3(1,1,0)),f.x),f.y),mix(mix(hash(a+vec3(0,0,1)),hash(a+vec3(1,0,1)),f.x),mix(hash(a+vec3(0,1,1)),hash(a+vec3(1,1,1)),f.x),f.y),f.z);}
float reservoir(vec3 p){return .24+.17*noise(p*.48);}
bool boundary(ivec3 p){return any(lessThanEqual(p,ivec3(0)))||any(greaterThanEqual(p,N-1));}
float blastShape(vec3 world,int i){
 float age=blastA[i].w,power=blastB[i].w;if(power<=0.||age>1.3)return 0.;
 float scale=sqrt(max(blastA[i].z,6.)/18.);
 float radius=(1.15+3.8*(1.-exp(-age*7.)))*scale*sqrt(power)*blastC[i].z;
 vec3 axis=blastB[i].xyz,center=blastA[i].xyz+axis*age*(3.+power*3.);
 vec3 d=world-center;float along=dot(d,axis);vec3 across=d-axis*along;
 float r=length(vec2(length(across),along*.72))/max(.1,radius);if(r>1.22)return 0.;
 float folds=.74+.38*noise(world*(1.6/scale)-axis*age*5.+blastC[i].y);
 float front=r/folds;
 // A flame advances along the expanding boundary; it does not fill a ball.
 float body=smoothstep(.18,.43,front)*(1.-smoothstep(.70,1.,front));
 return body*power*(1.-exp(-age*65.))*exp(-age*2.6)*mix(.38,1.,blastC[i].w);
}
float foldedFront(vec3 world,int i){
 float age=foldA[i].w,power=foldB[i].w;
 if(power<=0.||age<0.||age>4.6)return 0.;
 vec3 axis=normalize(foldB[i].xyz+vec3(.00001));
 vec3 side=normalize(cross(axis,abs(axis.y)<.85?vec3(0,1,0):vec3(0,0,1))),vertical=cross(side,axis);
 vec3 center=foldA[i].xyz+axis*age*(3.+power*2.);
 vec3 d=world-center;float scale=foldC[i].x,radius=(1.8+age*3.7)*scale;
 float phase=age*foldC[i].w+foldC[i].z*.618,cs=cos(phase),sn=sin(phase);
 float u=(dot(d,side)*cs-dot(d,vertical)*sn)/scale,v=(dot(d,side)*sn+dot(d,vertical)*cs)/scale;
 float radiusLocal=radius/scale,r=length(vec2(u,v))/radiusLocal;if(r>1.06)return 0.;
 float bend=(sin(u*.8+phase)*cos(v*.55-phase)-sin(phase)*cos(phase))+.55*(sin(v*1.1-phase)+sin(phase));
 float curvature=.28*(u*u-v*v)/(radiusLocal+1.);
 float plane=dot(d,axis)-(curvature+bend*(.65+age*.22))*scale;
 float thickness=.58+scale*.22;
 float body=(1.-smoothstep(thickness*.25,thickness,abs(plane)))*(1.-smoothstep(.62,1.04,r));
 float envelope=smoothstep(0.,.2,age)*(1.-smoothstep(2.8,4.6,age));
 return body*power*envelope;
}
// Accumulated heat, intersection strength, circular color, strongest front.
vec4 frontField(vec3 world){
 float total=0.,strongest=0.,collision=0.;vec3 leading=vec3(0.);vec2 color=vec2(0.);
 for(int i=0;i<4;i++){
  float f=foldedFront(world,i);if(f<.001)continue;
  vec3 axis=normalize(foldB[i].xyz+vec3(.00001));
  if(strongest>.001)collision=max(collision,min(f,strongest)*(1.-smoothstep(.10,.65,dot(axis,leading))));
  if(f>strongest){strongest=f;leading=axis;}
  float hue=foldC[i].y*1.04719755;color+=vec2(cos(hue),sin(hue))*f;total+=f;
 }
 float hue=mod(atan(color.y,color.x+.000001)/6.2831853+1.,1.);
 return vec4(min(total,2.),min(collision,1.5),hue,strongest);
}
`;
class GPUAtmosphere{
 constructor(gl){this.gl=gl;this.stepCount=0;this.coverage=0;this.meanHeat=0;this.meanWater=0;this.error=null;this.extension=gl.getExtension('EXT_color_buffer_float');if(!this.extension)throw Error('Floating-point WebGL2 rendering is required');
  this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
  this.vel=[this.target(),this.target()];this.state=[this.target(2),this.target(2)];this.flame=[this.target(),this.target()];this.history=[this.target(),this.target()];this.p=[this.target(),this.target()];this.div=this.target();this.probeTarget=this.target(1,true);this.surface=this.target(1,false,160,100);
  this.programs={};
  this.programs.init=this.program(`layout(location=0)out vec4 outChem;layout(location=1)out vec4 outHumidity;void main(){vec3 p=gridWorld(vec3(coord()));float fuel=reservoir(p);outChem=vec4(0.,fuel,0.,0.);outHumidity=vec4(0.);}`);
  this.programs.velocity=this.program(`out vec4 result;void main(){
 ivec3 p=coord();if(boundary(p)){result=vec4(0.);return;}
 vec3 world=gridWorld(vec3(p)),v=fetch(velocity,p).xyz;
 v=sample3(velocity,gridAt(world-v*dt)).xyz*exp(-dt*2.1);
 vec4 c=fetch(chem,p);v.y+=dt*c.x*1.35;
 vec3 curl=vec3(cos(world.y*1.6-time*2.1)*sin(world.z*1.3),sin(world.x*1.5+time*1.8)*cos(world.z*1.7),cos(world.x*1.4-time*1.9)*sin(world.y*1.8));
 v+=curl*dt*min(c.x,1.)*.65;
 vec4 remembered=fetch(history,p);
 vec3 memoryGradient=vec3(fetch(history,p+ivec3(1,0,0)).x-fetch(history,p-ivec3(1,0,0)).x,fetch(history,p+ivec3(0,1,0)).x-fetch(history,p-ivec3(0,1,0)).x,fetch(history,p+ivec3(0,0,1)).x-fetch(history,p-ivec3(0,0,1)).x)/metric(p);
 v+=memoryGradient*dt*min(c.x,1.)*1.4;
 for(int i=0;i<4;i++){
  float body=foldedFront(world,i);if(body<.001)continue;
  vec3 axis=normalize(foldB[i].xyz+vec3(.00001)),d=world-foldA[i].xyz;
  v+=(axis*12.+cross(axis,d/max(length(d),.5))*6.)*body*dt;
 }
 // Impulsive expansion and a rotating shoulder, confined to each live blast.
 for(int i=0;i<20;i++){
  float body=blastShape(world,i);if(body<.001)continue;
  vec3 axis=blastB[i].xyz,center=blastA[i].xyz+axis*blastA[i].w*(3.+blastB[i].w*3.);
  vec3 d=world-center,radial=d/max(length(d),.25);
  v+=(radial*18.+axis*15.+cross(axis,radial)*9.)*body*dt;
 }
 for(int i=0;i<6;i++){vec3 d=world-bolts[i].xyz;float r=length(d);v+=d/max(r,.15)*(1.-smoothstep(.35,1.8,r))*bolts[i].w*dt*28.;}
 vec3 impulse=vec3(0.);float influence=0.;
 for(int i=0;i<8;i++){vec3 d=(world-gustPoint[i].xyz)/max(gustPoint[i].w,.1);float w=exp(-dot(d,d)*1.5)*gustForce[i].w;impulse+=gustForce[i].xyz*w;influence+=w;}
 v+=impulse/max(1.,influence)*dt*2.;result=vec4(clamp(v,vec3(-18.),vec3(18.)),0.);
}`);
  this.programs.divergence=this.program(`out vec4 result;void main(){ivec3 p=coord();if(boundary(p)){result=vec4(0.);return;}vec3 a=fetch(velocity,p+ivec3(1,0,0)).xyz-fetch(velocity,p-ivec3(1,0,0)).xyz,b=fetch(velocity,p+ivec3(0,1,0)).xyz-fetch(velocity,p-ivec3(0,1,0)).xyz,c=fetch(velocity,p+ivec3(0,0,1)).xyz-fetch(velocity,p-ivec3(0,0,1)).xyz;result=vec4(.5*(a.x/metric(p).x+b.y/metric(p).y+c.z/metric(p).z),0.,0.,0.);}`);
  this.programs.pressure=this.program(`out vec4 result;void main(){ivec3 p=coord();if(boundary(p)){result=vec4(0.);return;}vec3 spacing=metric(p),s=1./(spacing*spacing);float a=fetch(pressure,p+ivec3(1,0,0)).x+fetch(pressure,p-ivec3(1,0,0)).x,b=fetch(pressure,p+ivec3(0,1,0)).x+fetch(pressure,p-ivec3(0,1,0)).x,c=fetch(pressure,p+ivec3(0,0,1)).x+fetch(pressure,p-ivec3(0,0,1)).x;result=vec4((dot(vec3(a,b,c),s)-fetch(divergence,p).x)/(2.*(s.x+s.y+s.z)),0.,0.,0.);}`);
  this.programs.project=this.program(`out vec4 result;void main(){ivec3 p=coord();if(boundary(p)){result=vec4(0.);return;}vec3 gradient=vec3(fetch(pressure,p+ivec3(1,0,0)).x-fetch(pressure,p-ivec3(1,0,0)).x,fetch(pressure,p+ivec3(0,1,0)).x-fetch(pressure,p-ivec3(0,1,0)).x,fetch(pressure,p+ivec3(0,0,1)).x-fetch(pressure,p-ivec3(0,0,1)).x)/metric(p)*.5;result=vec4(fetch(velocity,p).xyz-gradient,0.);}`);
  this.programs.react=this.program(`layout(location=0)out vec4 result;layout(location=1)out vec4 moisture;
void main(){ivec3 p=coord();vec3 world=gridWorld(vec3(p));if(boundary(p)){result=vec4(0.,reservoir(world)*feed,0.,0.);moisture=vec4(0.);return;}
vec3 v=fetch(velocity,p).xyz,q=gridAt(world-v*dt);vec4 c=sample3(chem,q),h=sample3(humidity,q);
float liquid=sample3(chem,q+vec3(0.,dt*4./cell.y,0.)).w;liquid+=rain*dt*.62*smoothstep(6.1,7.5,world.y);
float neighbor=(fetch(chem,p+ivec3(1,0,0)).x+fetch(chem,p-ivec3(1,0,0)).x+fetch(chem,p+ivec3(0,1,0)).x+fetch(chem,p-ivec3(0,1,0)).x+fetch(chem,p+ivec3(0,0,1)).x+fetch(chem,p-ivec3(0,0,1)).x)/6.;c.x+=dt*(3.+audioDrive.x*7.)*(neighbor-c.x);
for(int i=0;i<6;i++){vec3 d=(world-bolts[i].xyz)/.9;float ignition=(1.-smoothstep(.55,1.,length(d)))*bolts[i].w;c.x+=ignition*dt*55.;c.y=max(c.y,ignition*.65);h.w=max(h.w,ignition*.98);float flashed=min(liquid,ignition*dt*18.);liquid-=flashed;h.x+=flashed;}
float wake=0.;for(int i=0;i<12;i++){vec3 a=wakeA[i].xyz,b=wakeB[i].xyz,line=b-a;vec3 nearby=world;float along=clamp(dot(nearby-a,line)/max(dot(line,line),.0001),0.,1.);vec3 d=(nearby-mix(a,b,along))/max(wakeA[i].w,.1);wake=max(wake,(1.-smoothstep(.45,1.,length(d)))*wakeB[i].w);}c.x=max(c.x,min(1.85,wake*1.4));c.y=max(c.y,min(.9,wake*.65));if(wake>.1)h.w=rollColor.x/6.;float dried=min(liquid,wake*dt*5.);liquid-=dried;h.x+=dried;
// New fire is born in compact expanding bodies, never a full-volume fog feed.
float deposited=0.,color=0.;
for(int i=0;i<20;i++){float body=blastShape(world,i);if(body>deposited){deposited=body;color=blastC[i].x/6.;}}
if(deposited>.015){c.x=max(c.x,min(1.85,deposited*2.8));c.y=max(c.y,min(.9,deposited*1.35));h.w=color;}
vec4 fronts=frontField(world),remembered=fetch(history,p);
c.x+=dt*(fronts.x*12.+fronts.y*6.)*clamp(c.y*4.,0.,1.);
if(fronts.x>.06&&deposited<.08&&wake<.1)h.w=fronts.z;
if(remembered.y>.08&&c.x>.5){float mixed=mod(atan(remembered.w,remembered.z+.00001)/6.2831853+1.16,1.);h.w=mix(h.w,mixed,clamp(remembered.y*.55,0.,.65));}
float speed=length(v),strain=length(fetch(velocity,p+ivec3(1,0,0)).xyz-fetch(velocity,p-ivec3(1,0,0)).xyz)/metric(p).x+length(fetch(velocity,p+ivec3(0,1,0)).xyz-fetch(velocity,p-ivec3(0,1,0)).xyz)/metric(p).y;
float movingSource=smoothstep(.04,.4,max(deposited,fronts.x));
float oxygen=(.7+.35*(1.-exp(-speed*2.)))/(1.+c.y*1.8)*exp(-liquid*8.),stress=max(0.,strain-2.)*.13+max(0.,speed-2.5)*.32*(1.-movingSource*.80);
float stable=exp(-stress*stress/(.3+c.x*.4));float react=clamp((c.x-.18)*6.,0.,1.)*oxygen*stable;
float used=min(c.y,dt*react*1.6);c.y-=used;c.x+=used*(3.5+audioDrive.w*2.);c.z+=used*.24;
float evaporation=min(liquid,min(c.x*.28,dt*(.02+c.x*.35)));liquid-=evaporation;c.x=max(0.,c.x-evaporation*3.);h.x+=evaporation;
float saturation=.018+c.x*.13,condensation=max(0.,h.x-saturation)*(1.-exp(-dt*2.));h.x-=condensation;h.y+=condensation;c.x+=condensation*.8;
float reevap=min(h.y,max(0.,saturation-h.x)*dt*.8);h.y-=reevap;h.x+=reevap;c.x=max(0.,c.x-reevap*.8);
c.x=max(0.,c.x-dt*(.25+(1.-smoothstep(.01,.12,c.y))*.8));c.x*=exp(-dt*(1.85+speed*.14+liquid*2.));c.z*=exp(-dt*.18);h.xy*=exp(-dt*.06);
float renewal=(.10+.60*smoothstep(.35,.65,noise(world*.22+vec3(time*.075,-time*.11,time*.06))))*(1.-clamp(remembered.x*.55,0.,.55));c.y=mix(c.y,reservoir(world),clamp(dt*feed*renewal*(1.-smoothstep(.12,.32,c.x)),0.,1.));result=clamp(vec4(c.xyz,liquid),vec4(0.),vec4(2.,1.,1.,1.));moisture=vec4(clamp(h.xy,vec2(0.),vec2(1.)),used/max(dt,.001),clamp(h.w,0.,1.));}`);
  this.programs.history=this.program(`out vec4 result;void main(){
   ivec3 p=coord();if(boundary(p)){result=vec4(0.);return;}
   vec4 old=fetch(history,p),c=fetch(chem,p),h=fetch(humidity,p),fronts=frontField(gridWorld(vec3(p)));
   float burning=smoothstep(.30,1.15,c.x)*smoothstep(.10,.55,h.z);
   float compression=smoothstep(.5,2.8,-fetch(divergence,p).x)*burning*.35;
   float collision=max(fronts.y*smoothstep(.35,1.,c.x),compression);
   float memory=max(old.x*exp(-dt/5.5),burning);
   float afterglow=max(old.y*exp(-dt*4.),collision);
   float hue=(fronts.x>.1?fronts.z:h.w)*6.2831853;
   vec2 chroma=mix(old.zw,vec2(cos(hue),sin(hue)),clamp(dt*(burning*3.+collision*5.),0.,1.));
   result=vec4(memory,clamp(afterglow,0.,1.5),chroma);
  }`);
  this.programs.flame=this.program(`out vec4 result;void main(){
   ivec3 p=coord();if(boundary(p)){result=vec4(0.);return;}
   vec3 world=gridWorld(vec3(p)),v=fetch(velocity,p).xyz;vec4 old=fetch(flame,p);
   vec3 fold=vec3(sin(world.y*1.5-time*2.4)*cos(world.z*.9),0.,cos(world.x*1.4+time*2.1)*sin(world.y*.8));
   vec3 rise=vec3(0.,3.5+old.x*2.5,0.)+fold*(.7+old.x*.8);
   vec4 f=sample3(flame,gridAt(world-(v+rise)*dt));
   float neighbor=(fetch(flame,p+ivec3(1,0,0)).x+fetch(flame,p-ivec3(1,0,0)).x+fetch(flame,p+ivec3(0,1,0)).x+fetch(flame,p-ivec3(0,1,0)).x+fetch(flame,p+ivec3(0,0,1)).x+fetch(flame,p-ivec3(0,0,1)).x)/6.;
   f.x=max(0.,f.x+dt*1.5*(neighbor-f.x));f.x*=exp(-dt*1.25);
   vec4 c=fetch(chem,p),h=fetch(humidity,p);
   float source=smoothstep(.58,1.3,c.x)*smoothstep(.18,.65,h.z)*clamp(c.y*4.,0.,1.);
   if(source>f.x*.7){f.x=max(f.x,source*1.4);f.y=h.w;}
   f.x=max(0.,f.x-dt*(.08+.16*noise(world*1.5+vec3(0.,-time*2.,0.))));
   vec4 remembered=fetch(history,p);
   if(f.x>.15)f.x+=dt*remembered.y*.8;
   result=vec4(clamp(f.x,0.,1.6),f.y,source,0.);
  }`);
  this.programs.probe=this.program(`out vec4 result;void main(){vec4 total=vec4(0.);for(int i=0;i<768;i++){float id=float(i);vec3 p=vec3(hash(vec3(id,1,3)),hash(vec3(6,id,7)),hash(vec3(8,4,id)))*vec3(N-1);vec4 c=sample3(chem,p),h=sample3(humidity,p);total+=vec4(step(.22,c.x)*step(.018,h.z),c.x*.5,c.w,h.z*.5);}result=total/768.;}`);
  this.programs.testState=this.program(`uniform vec4 testChem;layout(location=0)out vec4 c;layout(location=1)out vec4 h;void main(){c=testChem;h=vec4(0.);}`);
  this.programs.testVelocity=this.program(`uniform vec4 testFlow;out vec4 v;void main(){v=testFlow;}`);
  this.programs.flowProbe=this.program(`out vec4 result;void main(){result=vec4(abs(fetch(velocity,N/2).xyz)/9.,1.);}`);
  this.programs.fuelProbe=this.program(`out vec4 result;void main(){vec4 c=fetch(chem,N/2),h=fetch(humidity,N/2);result=vec4(c.y,h.w,c.x*.5,1.);}`);
  this.programs.uniqueProbe=this.program(`uniform vec3 sourcePoint,otherPoint;out vec4 result;void main(){result=vec4(sample3(chem,gridAt(sourcePoint)).x*.5,sample3(chem,gridAt(otherPoint)).x*.5,0.,1.);}`);
  this.programs.flameProbe=this.program(`out vec4 result;void main(){result=vec4(fetch(flame,N/2).x/1.6,0.,0.,1.);}`);
  this.programs.frontProbe=this.program(`uniform vec3 probePoint;out vec4 result;void main(){vec4 f=frontField(probePoint);result=vec4(f.x*.5,f.y/1.5,f.z,1.);}`);
  this.programs.historyPoint=this.program(`out vec4 result;void main(){vec4 h=fetch(history,N/2);result=vec4(h.x,h.y/1.5,0.,1.);}`);
  this.programs.historyMeasure=this.program(`out vec4 result;void main(){float memory=0.,peak=0.,visible=0.;for(int i=0;i<384;i++){float n=float(i);vec2 uv=vec2(hash(vec3(n,1,9)),hash(vec3(3,n,7)));vec3 p=vec3(uv,hash(vec3(8,2,n)))*vec3(N-1);vec4 h=sample3(history,p);memory+=h.x;peak=max(peak,h.y);visible+=step(.0001,texture(surfaceDepth,uv).x);}result=vec4(memory/384.,peak/1.5,visible/384.,1.);}`);
  this.programs.testRamp=this.program(`layout(location=0)out vec4 c;layout(location=1)out vec4 h;void main(){c=vec4(vec3(coord())/vec3(N-1),0.);h=vec4(0.);}`);
  this.programs.wrapProbe=this.program(`out vec4 result;void main(){result=vec4(sample3(chem,vec3(-.5)).rgb,fetch(chem,N-1).x);}`);
  this.programs.pickRay=this.program(`uniform vec3 pickEye,pickRay;out vec4 result;void main(){result=vec4(0.);for(int i=0;i<80;i++){float depth=3.+float(i)*.7;vec3 world=pickEye+pickRay*(depth/max(pickRay.z,.1));vec3 p=gridAt(world);vec4 c=sample3(chem,p),h=sample3(humidity,p);if(c.x>.45&&h.z>.09){result=vec4(depth/59.,h.z,0.,1.);break;}}}`);
  this.programs.surface=this.program(`uniform vec3 viewEye,viewRight,viewUp,viewForward;uniform vec2 viewSize,surfaceSize;uniform float viewFocal;out vec4 result;void main(){
   vec2 uv=gl_FragCoord.xy/surfaceSize;
   vec3 ray=viewForward+viewRight*((uv.x-.5)*viewSize.x/viewFocal)+viewUp*((uv.y-.5)*viewSize.y/viewFocal);
   float opacity=0.;result=vec4(0.);
   for(int i=0;i<80;i++){
    float depth=3.+float(i)*.7;vec3 p=gridAt(viewEye+ray*depth);
    vec4 c=sample3(chem,p),h=sample3(humidity,p),f=sample3(flame,p);
    float body=smoothstep(.70,1.3,c.x)*smoothstep(.20,.55,h.z);
    float fire=smoothstep(.30,.90,f.x)*.55;
    opacity+=(1.-opacity)*max(body,fire)*.26;
    if(opacity>.26){result=vec4(depth/64.,opacity,0.,1.);break;}
   }
  }`);
  this.programs.surfaceProbe=this.program(`out vec4 result;void main(){result=vec4(texture(surfaceDepth,vec2(.5)).x,0.,0.,1.);}`);
  this.read=new Uint8Array(4);this.run(this.programs.init,this.state[0],{});this.run(this.programs.init,this.state[1],{});
 }
 verifyPhysics(){const gl=this.gl,values={dt:.05,time:0,rain:0,feed:0,audio:0,gustPoint:new Float32Array(32),gustForce:new Float32Array(32),bolts:new Float32Array(24),wakeA:new Float32Array(48),wakeB:new Float32Array(48),foldA:new Float32Array(16),foldB:new Float32Array(16),foldC:new Float32Array(16),blastA:new Float32Array(80),blastB:new Float32Array(80),blastC:new Float32Array(80)},results={};
  for(let [name,speed,water]of [['still',0,0],['fan',.65,0],['gust',8,0],['wet',0,.5]]){this.run(this.programs.testState,this.state[0],{},{testChem:[.6,.45,0,water]});this.run(this.programs.testVelocity,this.vel[0],{},{testFlow:[speed,0,0,0]});for(let i=0;i<5;i++){this.run(this.programs.react,this.state[1],{velocity:this.vel[0].textures[0],chem:this.state[0].textures[0],humidity:this.state[0].textures[1]},values);this.state.reverse();}this.run(this.programs.probe,this.probeTarget,{chem:this.state[0].textures[0],humidity:this.state[0].textures[1]});gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,this.read);results[name]={heat:this.read[1]/255*2,reaction:this.read[3]/255*2,water:this.read[2]/255};}
  let flow=[];for(let count of [1,8]){this.run(this.programs.testState,this.state[0],{},{testChem:[0,.45,0,0]});this.run(this.programs.testVelocity,this.vel[0],{},{testFlow:[0,0,0,0]});const gustPoint=new Float32Array(32),gustForce=new Float32Array(32),center=[0,0,31];for(let i=0;i<count;i++){gustPoint.set([...center,6],i*4);gustForce.set([4,0,0,1],i*4);}this.run(this.programs.velocity,this.vel[1],{velocity:this.vel[0].textures[0],chem:this.state[0].textures[0]},{...values,gustPoint,gustForce});this.run(this.programs.flowProbe,this.probeTarget,{velocity:this.vel[1].textures[0]});gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,this.read);flow.push(this.read[0]/255*9);}
  results.inputForce={single:flow[0],overlapping:flow[1],pass:flow[0]>0&&Math.abs(flow[1]-flow[0])<.04};
  this.run(this.programs.testRamp,this.state[0],{});this.run(this.programs.wrapProbe,this.probeTarget,{chem:this.state[0].textures[0]});gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,this.read);results.openBoundary={outside:Array.from(this.read.slice(0,3),v=>v/255),pass:this.read.slice(0,3).every(v=>v===0)&&this.read[3]>250};
  const renewed=[];this.run(this.programs.testVelocity,this.vel[0],{},{testFlow:[0,0,0,0]});for(const heat of [1.2,0]){this.run(this.programs.testState,this.state[0],{},{testChem:[heat,0,0,0]});for(let i=0;i<3;i++){this.run(this.programs.react,this.state[1],{velocity:this.vel[0].textures[0],chem:this.state[0].textures[0],humidity:this.state[0].textures[1]},{...values,feed:1});this.state.reverse();}this.run(this.programs.fuelProbe,this.probeTarget,{chem:this.state[0].textures[0],humidity:this.state[0].textures[1]});gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,this.read);renewed.push(this.read[0]/255);}
  results.fuelRenewal={hot:renewed[0],cold:renewed[1],pass:renewed[0]<.005&&renewed[1]>.005};
  this.run(this.programs.testState,this.state[0],{},{testChem:[1.2,.2,0,0]});const cloudBolt=new Float32Array(24);cloudBolt.set([0,0,31,1]);this.run(this.programs.react,this.state[1],{velocity:this.vel[0].textures[0],chem:this.state[0].textures[0],humidity:this.state[0].textures[1]},{...values,bolts:cloudBolt});this.run(this.programs.fuelProbe,this.probeTarget,{chem:this.state[1].textures[0],humidity:this.state[1].textures[1]});gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,this.read);results.cloudIgnition={fuel:this.read[0]/255,tint:this.read[1]/255,pass:this.read[0]/255>.4&&this.read[1]/255>.7};
  this.run(this.programs.init,this.state[0],{});
  const blastA=new Float32Array(80),blastB=new Float32Array(80),blastC=new Float32Array(80);
  blastA.set([-8,0,20,.18]);blastB.set([0,0,1,1]);blastC.set([1,33,1,1]);
  this.run(this.programs.react,this.state[1],{velocity:this.vel[0].textures[0],chem:this.state[0].textures[0],humidity:this.state[0].textures[1]},{...values,blastA,blastB,blastC});
  this.run(this.programs.uniqueProbe,this.probeTarget,{chem:this.state[1].textures[0]},{sourcePoint:[-5.8,0,21.08],otherPoint:[5.8,0,21.08]});
  gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,this.read);
  results.uniqueBlast={sourceHeat:this.read[0]/255*2,oppositeHeat:this.read[1]/255*2,pass:this.read[0]>.05*255&&this.read[1]===0};
  this.run(this.programs.testState,this.state[0],{},{testChem:[1.3,.6,0,0]});
  this.run(this.programs.react,this.state[1],{velocity:this.vel[0].textures[0],chem:this.state[0].textures[0],humidity:this.state[0].textures[1]},values);this.state.reverse();
  const advanceFlame=()=>{this.run(this.programs.flame,this.flame[1],{velocity:this.vel[0].textures[0],chem:this.state[0].textures[0],humidity:this.state[0].textures[1],flame:this.flame[0].textures[0]},{...values,dt:.1});this.flame.reverse();};
  advanceFlame();this.run(this.programs.flameProbe,this.probeTarget,{flame:this.flame[0].textures[0]});gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,this.read);const lit=this.read[0]/255*1.6;
  this.run(this.programs.testState,this.state[0],{},{testChem:[0,0,0,0]});for(let i=0;i<20;i++)advanceFlame();
  this.run(this.programs.flameProbe,this.probeTarget,{flame:this.flame[0].textures[0]});gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,this.read);const spent=this.read[0]/255*1.6;
  results.flameLifecycle={lit,spent,pass:lit>.3&&spent<lit*.2};
  const foldA=new Float32Array(16),foldB=new Float32Array(16),foldC=new Float32Array(16),frontCases=[];
  foldA.set([-2.5,0,31,.5]);foldB.set([1,0,0,1]);foldC.set([1,.5,0,.7]);
  for(const kind of ['single','opposed','parallel']){
   if(kind==='opposed'){foldA.set([2.5,0,31,.5],4);foldB.set([-1,0,0,1],4);foldC.set([1,2.5,1,-.7],4);}
   if(kind==='parallel'){foldA.set([-2.5,0,31,.5],4);foldB.set([1,0,0,1],4);}
   this.run(this.programs.frontProbe,this.probeTarget,{},{foldA,foldB,foldC,probePoint:[0,0,31]});gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,this.read);
   frontCases.push({kind,energy:this.read[0]/255*2,collision:this.read[1]/255*1.5});
  }
  results.frontIntersections={cases:frontCases,pass:frontCases[0].collision===0&&frontCases[1].collision>.8&&frontCases[2].collision===0};
  const collisionHeat=[];
  for(const opposed of [false,true]){
   foldA.set([opposed?2.5:-2.5,0,31,.5],4);foldB.set([opposed?-1:1,0,0,1],4);
   this.run(this.programs.testState,this.state[0],{},{testChem:[.10,.4,0,0]});
   this.run(this.programs.react,this.state[1],{velocity:this.vel[0].textures[0],chem:this.state[0].textures[0],humidity:this.state[0].textures[1]},{...values,foldA,foldB,foldC});
   this.run(this.programs.uniqueProbe,this.probeTarget,{chem:this.state[1].textures[0]},{sourcePoint:[0,0,31],otherPoint:[0,0,31]});gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,this.read);collisionHeat.push(this.read[0]/255*2);
  }
  results.collisionHeating={parallel:collisionHeat[0],opposed:collisionHeat[1],pass:collisionHeat[1]>collisionHeat[0]+.1};
  this.run(this.programs.history,this.history[1],{chem:this.state[1].textures[0],humidity:this.state[1].textures[1],divergence:this.div.textures[0]},{...values,foldA,foldB,foldC});this.history.reverse();
  this.run(this.programs.historyPoint,this.probeTarget,{});gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,this.read);const marked=this.read[0]/255,hotCollision=this.read[1]/255*1.5;
  this.run(this.programs.testState,this.state[0],{},{testChem:[0,0,0,0]});
  for(let i=0;i<30;i++){this.run(this.programs.history,this.history[1],{chem:this.state[0].textures[0],humidity:this.state[0].textures[1],divergence:this.div.textures[0]},{...values,dt:.1});this.history.reverse();}
  this.run(this.programs.historyPoint,this.probeTarget,{});gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,this.read);const retained=this.read[0]/255,coldCollision=this.read[1]/255*1.5;
  results.spatialMemory={marked,retained,hotCollision,coldCollision,pass:marked>.5&&retained>.2&&retained<marked&&hotCollision>.5&&coldCollision<.02};
  const testCamera=new ElementalSpace.SpaceCamera();testCamera.resize(640,360);
  this.run(this.programs.testState,this.state[0],{},{testChem:[1.3,.6,0,0]});
  this.run(this.programs.react,this.state[1],{velocity:this.vel[0].textures[0],chem:this.state[0].textures[0],humidity:this.state[0].textures[1]},values);this.state.reverse();
  this.visibility(testCamera);this.run(this.programs.surfaceProbe,this.probeTarget,{surfaceDepth:this.surface.textures[0]});gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,this.read);const warmDepth=this.read[0]/255*64;
  this.run(this.programs.testState,this.state[0],{},{testChem:[0,0,0,0]});
  this.visibility(testCamera);this.run(this.programs.surfaceProbe,this.probeTarget,{surfaceDepth:this.surface.textures[0]});gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,this.read);const coldDepth=this.read[0]/255*64;
  results.visibility={warmDepth,coldDepth,pass:warmDepth>3&&warmDepth<15&&coldDepth===0};
  results.pass=results.fan.reaction>results.still.reaction&&results.gust.reaction<results.still.reaction*.25&&results.wet.reaction<results.still.reaction*.25&&results.wet.heat<results.still.heat&&results.inputForce.pass&&results.openBoundary.pass&&results.fuelRenewal.pass&&results.cloudIgnition.pass&&results.uniqueBlast.pass&&results.flameLifecycle.pass&&results.frontIntersections.pass&&results.collisionHeating.pass&&results.spatialMemory.pass&&results.visibility.pass;
  for(let target of [...this.vel,...this.p,...this.flame,...this.history,this.div]){gl.bindFramebuffer(gl.FRAMEBUFFER,target.fbo);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}for(let target of this.state)this.run(this.programs.init,target,{});this.selfCheck=results;return results;
 }
 pick(camera,x,y){const ray=camera.ray(x,y),gl=this.gl;this.run(this.programs.pickRay,this.probeTarget,{chem:this.state[0].textures[0],humidity:this.state[0].textures[1]},{pickEye:camera.eye,pickRay:ray});gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,this.read);if(!this.read[3]){this.lastPick={hit:false};return null;}const depth=this.read[0]/255*59;this.lastPick={hit:true,depth};return camera.eye.map((v,i)=>v+ray[i]*depth/ray[2]);}
 visibility(camera){
  const gl=this.gl,height=Math.round(160*camera.height/camera.width);
  if(this.surface.height!==height){this.surface.height=height;gl.bindTexture(gl.TEXTURE_2D,this.surface.textures[0]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,160,height,0,gl.RGBA,gl.HALF_FLOAT,null);}
  this.run(this.programs.surface,this.surface,{chem:this.state[0].textures[0],humidity:this.state[0].textures[1],flame:this.flame[0].textures[0]},{viewEye:camera.eye,viewRight:camera.right,viewUp:camera.up,viewForward:camera.forward,viewSize:[camera.width,camera.height],surfaceSize:[160,height],viewFocal:camera.focal,viewAspect:camera.width/camera.height});
 }
 program(fragment){const gl=this.gl,p=gl.createProgram(),vs=`#version 300 es\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`;for(let [type,source]of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,'#version 300 es\n#define FRAGMENT_SCOPE\n'+common+fragment]]){let s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);gl.deleteShader(s);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return{p,uniforms:new Map()};}
 target(count=1,byte=false,width=TW,height=TH){const gl=this.gl,fbo=gl.createFramebuffer(),textures=[];gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);for(let i=0;i<count;i++){let tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,byte?gl.RGBA8:gl.RGBA16F,byte?1:width,byte?1:height,0,gl.RGBA,byte?gl.UNSIGNED_BYTE:gl.HALF_FLOAT,null);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+i,gl.TEXTURE_2D,tex,0);textures.push(tex);}gl.drawBuffers(textures.map((_,i)=>gl.COLOR_ATTACHMENT0+i));if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete fluid framebuffer');gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);return{fbo,textures,width:byte?1:width,height:byte?1:height};}
 run(program,target,textures,values={}){const gl=this.gl;gl.bindVertexArray(this.vao);gl.useProgram(program.p);gl.bindFramebuffer(gl.FRAMEBUFFER,target.fbo);gl.viewport(0,0,target.width,target.height);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);let unit=0;const loc=name=>{if(!program.uniforms.has(name))program.uniforms.set(name,gl.getUniformLocation(program.p,name));return program.uniforms.get(name);};for(let [name,texture]of Object.entries({history:this.history[0].textures[0],...textures})){const location=loc(name);if(location===null)continue;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(location,unit++);}for(let [name,value]of Object.entries(values)){const location=loc(name);if(location===null)continue;if(typeof value==='number')gl.uniform1f(location,value);else if(value.length===3)gl.uniform3fv(location,value);else if(value.length===2)gl.uniform2fv(location,value);else gl.uniform4fv(location,value);}const cloudLocation=loc('clouds');if(cloudLocation!==null)gl.uniform4fv(cloudLocation,ElementalSpace.CLOUDS.flat());gl.drawArrays(gl.TRIANGLES,0,3);}
 step(dt,state,audio,show={}){const gl=this.gl,point=new Float32Array(32),force=new Float32Array(32),bolts=new Float32Array(24),wakeA=new Float32Array(48),wakeB=new Float32Array(48);state.gusts.forEach((g,i)=>{point.set([...g.point,g.radius],i*4);force.set([...g.force,Math.exp(-g.age*1.8)],i*4);});if(!show.blastA)state.strikes.forEach((s,i)=>bolts.set([...s.target,s.age<.13?Math.exp(-s.age*10)*(s.origin==='audio'?.85:1):0],i*4));state.trails.forEach((s,i)=>{wakeA.set([...s.from,s.radius],i*4);wakeB.set([...s.to,s.gain*Math.exp(-s.age*8)],i*4);});
  const values={dt,time:state.time,rain:0,feed:1,audio:audio.level||0,gustPoint:point,gustForce:force,bolts,wakeA,wakeB,...show};
  this.run(this.programs.velocity,this.vel[1],{velocity:this.vel[0].textures[0],chem:this.state[0].textures[0]},values);
  this.run(this.programs.divergence,this.div,{velocity:this.vel[1].textures[0]});
  for(let i=0;i<5;i++){this.run(this.programs.pressure,this.p[1],{pressure:this.p[0].textures[0],divergence:this.div.textures[0]});this.p.reverse();}
  this.run(this.programs.project,this.vel[0],{velocity:this.vel[1].textures[0],pressure:this.p[0].textures[0]});
  this.run(this.programs.react,this.state[1],{velocity:this.vel[0].textures[0],chem:this.state[0].textures[0],humidity:this.state[0].textures[1]},values);this.state.reverse();
  this.run(this.programs.history,this.history[1],{chem:this.state[0].textures[0],humidity:this.state[0].textures[1],divergence:this.div.textures[0]},values);this.history.reverse();
  this.run(this.programs.flame,this.flame[1],{velocity:this.vel[0].textures[0],chem:this.state[0].textures[0],humidity:this.state[0].textures[1],flame:this.flame[0].textures[0]},values);this.flame.reverse();this.stepCount++;
  if(this.stepCount%12===0){this.run(this.programs.probe,this.probeTarget,{chem:this.state[0].textures[0],humidity:this.state[0].textures[1]});gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,this.read);this.coverage=this.read[0]/255;this.meanHeat=this.read[1]/255*2;this.meanWater=this.read[2]/255;state.measure(this.coverage);this.run(this.programs.historyMeasure,this.probeTarget,{surfaceDepth:this.surface.textures[0]});gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,this.read);this.meanMemory=this.read[0]/255;this.collisionPeak=this.read[1]/255*1.5;this.visibleFraction=this.read[2]/255;}
 }
}
root.ElementalGPU={GPUAtmosphere,common,NX,NY,NZ,TW,TH};
})(window);
