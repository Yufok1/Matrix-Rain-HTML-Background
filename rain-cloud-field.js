/* Cloud's actual GPU atmosphere. The four source modules are unmodified.
 * This adapter samples its moving combustion surfaces for Omni's existing
 * glyphs. It has no glyph renderer and creates no replacement population.
 */
(function(root){'use strict';
// Keep the source simulation intact, but compile only the passes this adapter
// uses. GPUAtmosphere also declares many diagnostic programs for its test UI.
class CloudAtmosphere extends ElementalGPU.GPUAtmosphere{
 program(fragment){return{fragment,p:null,uniforms:new Map()};}
 compile(program,wait=true){
  if(program.linked)return true;
  const gl=this.gl;
  this.parallel??=gl.getExtension('KHR_parallel_shader_compile')||false;
  if(!this.parallel){if(!program.p)Object.assign(program,super.program(program.fragment));program.linked=true;return true;}
  if(!program.p){
   program.p=gl.createProgram();
   const vertex='#version 300 es\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}';
   for(const [type,source]of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,'#version 300 es\n#define FRAGMENT_SCOPE\n'+ElementalGPU.common+program.fragment]]){
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);gl.attachShader(program.p,shader);gl.deleteShader(shader);
   }
   gl.linkProgram(program.p);
  }
  // Only initialization's tiny seed pass blocks. The heavy programs are
  // polled between frames, before their first draw or uniform lookup.
  if(!wait&&!gl.getProgramParameter(program.p,this.parallel.COMPLETION_STATUS_KHR))return false;
  if(!gl.getProgramParameter(program.p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program.p));
  program.linked=true;return true;
 }
 run(program,...args){this.compile(program);return super.run(program,...args);}
}
class OmniCloud{
 constructor(){
  this.canvas=document.createElement('canvas');this.gl=this.canvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'high-performance'});
  if(!this.gl)throw Error('Cloud requires WebGL 2.');
  const gl=this.gl;this.volume=new CloudAtmosphere(gl);
  this.state=new ElementalSpace.SpaceState();this.state.continuousFire=true;
  this.camera=new ElementalSpace.SpaceCamera();this.director=new ElementalShow.AudioDirector('elemental');this.motion=new ElementalMotion.FireMotion();
  this.acc=0;this.ready=false;this.queries=0;this.anchor=[1,0,0,0,1,0,0,0,1];this.viewScale=1;
  this.surfaceProgram=this.volume.program(root.CloudSurfaceSamples);
  this.programQueue=['velocity','divergence','pressure','project','react','history','flame','probe','historyMeasure','surface'].map(key=>this.volume.programs[key]);
  this.programQueue.push(this.surfaceProgram);
  // Stratify across the whole volume, rather than reading every fluid voxel
  // twice. The fluid simulation is unchanged; sampling/readback is 4x smaller.
  this.sampleWidth=320;this.sampleHeight=384;this.sampleStride=4;
  this.surfaceTarget=this.volume.target(2,false,this.sampleWidth,this.sampleHeight);
  this.surfacePositions=new Float32Array(this.sampleWidth*this.sampleHeight*4);this.surfaceColors=new Float32Array(this.sampleWidth*this.sampleHeight*4);
  this.candidates=[];this.surfaceAge=1;

 }
 setAnchor(r,box){this.anchor=[...r];this.viewScale=500/(box.height*.92);}
 envelope(){
  const a=root.audioReactiveActive?root.rainAudioMotion?.snapshot||{}:{},level=Math.min(1,Number(a.activity)||0),bands=new Float32Array(48);
  const spectrum=root.rainAudioMotion?.previous;
  if(root.audioReactiveActive&&spectrum)for(let i=0;i<48;i++)bands[i]=Math.min(1,spectrum[Math.floor(i*64/48)]/Math.log(25));
  const average=(lo,hi)=>bands.slice(lo,hi).reduce((s,x)=>s+x,0)/(hi-lo);
  return{onsets:a.events||0,value:{level,low:average(0,12),mid:average(12,32),high:average(32,48),pan:0,centroid:.4,flux:a.flux||0,width:0,transient:a.impulse||0,bands}};
 }
 step(dt,box){
  // Yield to the rain between shader builds instead of compiling all of them
  // inside one animation frame. This runs only after explicit cloud interest.
  if(this.programQueue.length){if(this.volume.compile(this.programQueue[0],false))this.programQueue.shift();return;}
  this.camera.resize(box.width,box.height);this.acc+=Math.min(dt,.1);const audio=this.envelope();
  let count=0;while(this.acc>=1/30&&count++<2){
   this.camera.update(this.state.time);this.director.step(1/30,audio,this.state,this.camera);
   Object.assign(this.director.values,this.motion.step(1/30,audio,this.state,this.camera,this.volume.visibleFraction??1));
   this.state.step(1/30);this.volume.step(1/30,this.state,audio.value,this.director.values);this.acc-=1/30;
  }
  if(count){this.surfaceAge+=dt;this.ready=this.volume.stepCount>=36;}
 }
 extract(box){
  const gl=this.gl,v=this.volume,c=this.camera;
  v.visibility(c);
  v.run(this.surfaceProgram,this.surfaceTarget,{chem:v.state[0].textures[0],humidity:v.state[0].textures[1],flame:v.flame[0].textures[0],velocity:v.vel[0].textures[0],history:v.history[0].textures[0],surfaceDepth:v.surface.textures[0]},
   {...this.director.values,time:this.state.time,eye:c.eye,right:c.right,up:c.up,forward:c.forward,viewport:[box.width,box.height],focal:c.focal,pixelRatio:1,glyphCount:94,viewAspect:box.width/box.height,sampleWidth:this.sampleWidth,sampleStride:this.sampleStride});
  gl.readBuffer(gl.COLOR_ATTACHMENT0);gl.readPixels(0,0,this.sampleWidth,this.sampleHeight,gl.RGBA,gl.FLOAT,this.surfacePositions);
  gl.readBuffer(gl.COLOR_ATTACHMENT1);gl.readPixels(0,0,this.sampleWidth,this.sampleHeight,gl.RGBA,gl.FLOAT,this.surfaceColors);gl.readBuffer(gl.COLOR_ATTACHMENT0);
  const r=this.anchor,f=this.viewScale,points=this.surfacePositions,colors=this.surfaceColors,list=[];
  for(let j=0;j<points.length;j+=4){if(colors[j+3]<.006||points[j+3]<=0)continue;
   const x=points[j]*32/f,y=-points[j+1]*32/f,z=points[j+2]*32-500;
   const alpha=colors[j+3],rgb=[colors[j]/alpha,colors[j+1]/alpha,colors[j+2]/alpha];
   const peak=Math.max(...rgb),tone=(1-Math.exp(-peak*3.6))/Math.max(peak,.00001);
   list.push({id:j/4*this.sampleStride,x:r[0]*x+r[3]*y+r[6]*z,y:r[1]*x+r[4]*y+r[7]*z,z:r[2]*x+r[5]*y+r[8]*z+500,rgb:rgb.map(v=>v*tone),alpha:Math.min(1,alpha*1.3),used:0});
  }
  this.candidates=list;this.surfaceAge=0;
 }

 sample(marks,box){
  if(!marks.length||!this.ready)return false;
  if(this.surfaceAge>=.15)this.extract(box);
  const list=this.candidates;if(!list.length)return false;
  const byId=new Map(list.map(p=>[p.id,p]));
  if(!this.flow||this.flow.length!==marks.length*4){this.flow=new Float32Array(marks.length*4);this.colors=new Float32Array(marks.length*4);}
  // Capacity-limited spatial assignment: an original surface sample cannot
  // swallow a whole column. Each visible glyph remains an independent record.
  const capacity=Math.max(1,Math.ceil(marks.length/list.length));
  for(const t of list)t.used=0;
  const pending=[];
  for(let i=0;i<marks.length;i++){const p=marks[i],t=byId.get(p.cloudState.surfaceId);if(t&&t.used<capacity){p.cloudState.surface=t;t.used++;}else pending.push(i);}
  const axes=['x','y','z'];
  const build=(items,depth=0,parent=null)=>{
   if(!items.length)return null;const axis=axes[depth%3];items.sort((a,b)=>a[axis]-b[axis]);const mid=items.length>>1,t=items[mid];
   const node={t,axis,parent,left:null,right:null,remaining:0};node.left=build(items.slice(0,mid),depth+1,node);node.right=build(items.slice(mid+1),depth+1,node);
   node.remaining=capacity-t.used+(node.left?.remaining||0)+(node.right?.remaining||0);return node;
  };
  // Stable assignments need no new spatial search; avoid sorting the entire
  // surface on a sample where every existing head still has its own target.
  const tree=pending.length?build(list.slice()):null;
  for(const i of pending){const p=marks[i];let best=null,distance=Infinity;
   const visit=node=>{if(!node||node.remaining<=0)return;const t=node.t,delta=p[node.axis]-t[node.axis];
    if(t.used<capacity){const d=(t.x-p.x)**2+(t.y-p.y)**2+(t.z-p.z)**2;if(d<distance){distance=d;best=node;}}
    visit(delta<0?node.left:node.right);if(delta*delta<distance)visit(delta<0?node.right:node.left);
   };visit(tree);
   const t=best?.t||list[i%list.length];t.used++;for(let n=best;n;n=n.parent)n.remaining--;
   p.cloudState.surface=t;p.cloudState.surfaceId=t.id;
  }
  for(let i=0;i<marks.length;i++){const p=marks[i],t=p.cloudState.surface,j=i*4;
   // Distinct surface micropositions for the existing records when they
   // outnumber source samples; never stack an entire trail on one coordinate.
   const seed=i*2.39996323,radius=capacity>1?Math.min(10,Math.sqrt(capacity)*1.5):0;
   this.flow[j]=(t.x+Math.cos(seed)*radius-p.x)*7;this.flow[j+1]=(t.y+Math.sin(seed)*radius-p.y)*7;this.flow[j+2]=(t.z+Math.sin(seed*1.7)*radius-p.z)*7;
   this.colors[j]=t.rgb[0];this.colors[j+1]=t.rgb[1];this.colors[j+2]=t.rgb[2];this.colors[j+3]=t.alpha/Math.sqrt(Math.max(1,capacity));
  }
  const error=this.gl.getError();if(error)throw Error('Cloud surface sampling failed: '+error);
  this.queries++;return true;
 }
}
root.OmniCloud=OmniCloud;
})(window);
