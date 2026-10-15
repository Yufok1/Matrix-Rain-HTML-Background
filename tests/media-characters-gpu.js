// Standalone proof page drives production code. Browser automation reads only its DOM.
(async function(){
 'use strict';
 const report={checks:[],errors:[],limits:'Deterministic GPU pixels, not a claim of subjective video clarity.'};
 const output=document.getElementById('report');
 const check=(ok,label)=>{if(!ok)throw Error(label);report.checks.push(label);};
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const source=document.createElement('canvas');source.width=source.height=400;const ctx=source.getContext('2d');
 let revision=0;window.rainMedia={active:true,options:{influence:100},get frame(){return {canvas:source,revision};}};
 const character=window.RainMediaCharacters,atlas=window.RainMediaGlyphAtlas;
 // Proof pages share this origin with the preview. Never persist test choices.
 const setMode=mode=>{character.mode=mode;},setDensity=value=>{character.density=value;};
 const mark={char:'ア',x:-50,y:80,z:500,fontSize:160,alpha:1,color:'#00ff00',rgb:[0,1,0],frame:0,trailLength:40,delta:[0,0,0]};
 const camera={frame:1,marks:[mark],pending:[],near:40,far:2000,rotation:[1,0,0,0,1,0,0,0,1],tiles:[{offset:[0,0,0]}],mediaDepiction:true};
 const blank=()=>{ctx.fillStyle='rgb(64,64,64)';ctx.fillRect(0,0,400,400);};
 const pixels=gpu=>{const w=gpu.canvas.width,h=gpu.canvas.height,p=new Uint8Array(w*h*4);gpu.gl.readPixels(0,0,w,h,gpu.gl.RGBA,gpu.gl.UNSIGNED_BYTE,p);p.width=w;p.height=h;return p;};
 const rect=mode=>{
  const m=mark,r=camera.rotation,t=camera.tiles[0].offset,world=[m.x+t[0],m.y+t[1],m.z+t[2]-500];
  const view=[r[0]*world[0]+r[1]*world[1]+r[2]*world[2],r[3]*world[0]+r[4]*world[1]+r[5]*world[2],r[6]*world[0]+r[7]*world[1]+r[8]*world[2]+500];
  const b=mode==='braille'?atlas.brailleBounds:atlas.shadeBounds,s=500/view[2];
  return {x:matrixCanvas.width/2+(view[0]+b[0]*m.fontSize)*s,y:matrixCanvas.height/2+(view[1]+b[1]*m.fontSize)*s,w:(b[2]-b[0])*m.fontSize*s,h:(b[3]-b[1])*m.fontSize*s};
 };
 const bits=[1,8,2,16,4,32,64,128];
 function pattern(mask){const b=rect('braille');blank();for(let i=0;i<8;i++){
   ctx.fillStyle=(mask&bits[i])?'rgb(192,192,192)':'rgb(64,64,64)';
   ctx.fillRect(b.x+(i%2)*b.w/2,b.y+Math.floor(i/2)*b.h/4,b.w/2,b.h/4);
  }revision++;}
 function readMask(p){const b=rect('braille');let mask=0;
  for(let i=0;i<8;i++){
   // Fine Dots has four circles per bit. This is one exact circle center.
   const x=Math.round((b.x+((i%2)*.5+.125)*b.w)*p.width/matrixCanvas.width),y=Math.round((b.y+(Math.floor(i/2)*.25+.0625)*b.h)*p.height/matrixCanvas.height);
   if(x<0||x>=p.width||y<0||y>=p.height)throw Error('Test glyph left viewport');
   if(p[((p.height-1-y)*p.width+x)*4]>10)mask|=bits[i];
  }return mask;
 }
 function draw(){rainCameraGPU.render(camera,1);if(rainCameraGPU.failed)throw Error('Production shader failed');return pixels(rainCameraGPU);}
 try{
  for(let n=0;!character.image&&n<100;n++)await sleep(20);
  check(!!character.image,'Bundled picture atlas loaded');
  blank();revision++;setMode('original');draw();referenceCameraGPU.render(camera,1);
  for(let n=0;(!rainCameraGPU.fontReady||!referenceCameraGPU.fontReady)&&n<100;n++)await sleep(20);
  check(rainCameraGPU.fontReady&&referenceCameraGPU.fontReady,'Both actual MSDF atlases ready');
  let actual=draw();referenceCameraGPU.render(camera,1);let expected=pixels(referenceCameraGPU);
  check(actual.every((v,i)=>v===expected[i]),'Original media mode is pixel-identical to accepted renderer');
  window.rainMedia.active=false;actual=draw();referenceCameraGPU.render(camera,1);expected=pixels(referenceCameraGPU);
  check(actual.every((v,i)=>v===expected[i]),'No-media rain is pixel-identical to accepted renderer');window.rainMedia.active=true;
  const history=JSON.stringify(camera.marks);setMode('braille');setDensity(50);
  for(let mask=1;mask<255;mask++){pattern(mask);const found=readMask(draw());if(found!==mask)throw Error('GPU Braille '+mask+' became '+found);}
  check(true,'All 254 non-flat masks match current GPU pixels and Unicode orientation');
  ctx.fillStyle='#000';ctx.fillRect(0,0,400,400);revision++;check(readMask(draw())===0,'Black frame immediately clears all old dots');
  ctx.fillStyle='#c0c0c0';ctx.fillRect(0,0,400,400);revision++;setDensity(100);check(readMask(draw())===255,'Full density lights all eight source-bit groups');
  setDensity(50);check(readMask(draw())===165,'Flat picture holds Canvas5 stable four-bit pattern');
  setDensity(0);check(readMask(draw())===0,'Zero density actually clears the glyph');setDensity(50);
  for(const config of [
   {x:-50,y:80,z:700,size:200,tile:[0,0,0],r:[1,0,0,0,1,0,0,0,1]},
   {x:-130,y:20,z:500,size:150,tile:[80,20,0],r:[1,0,0,0,1,0,0,0,1]},
   {x:-50,y:80,z:500,size:110,tile:[0,0,0],r:[0,-1,0,1,0,0,0,0,1]},
   {x:-60,y:50,z:600,size:150,tile:[0,0,0],r:[Math.cos(.3),0,Math.sin(.3),0,1,0,-Math.sin(.3),0,Math.cos(.3)]}
  ]){
   Object.assign(mark,{x:config.x,y:config.y,z:config.z,fontSize:config.size});camera.rotation=config.r;camera.tiles[0].offset=config.tile;rainCameraGPU.invalidate=true;
   pattern(184);check(readMask(draw())===184,'Projected mask follows depth/tile/rotation '+report.checks.length);
  }
  Object.assign(mark,{x:-50,y:80,z:500,fontSize:160});camera.rotation=[1,0,0,0,1,0,0,0,1];camera.tiles[0].offset=[0,0,0];rainCameraGPU.invalidate=true;
  setMode('shading');const ink=[];
  for(const value of [0,32,64,128,192,255]){
   ctx.fillStyle=`rgb(${value},${value},${value})`;ctx.fillRect(0,0,400,400);revision++;
   const p=draw();let count=0;for(let i=0;i<p.length;i+=4)if(p[i]>1)count++;ink.push(count);
  }
  check(ink[0]===0&&ink.at(-1)>ink[1]&&ink.at(-1)>ink[2],'Shading changes actual glyph coverage with source brightness');report.shadingVisiblePixels=ink;
  ctx.fillStyle='rgb(220,80,40)';ctx.fillRect(0,0,400,400);revision++;const colored=draw();let peak=-1;
  for(let i=0;i<colored.length;i+=4)if(colored[i]>peak)peak=colored[i];
  const index=colored.findIndex((v,i)=>i%4===0&&v===peak);check(peak>=218&&Math.abs(colored[index+1]-80)<=2&&Math.abs(colored[index+2]-40)<=2,'Source RGB retained without luminance opacity multiplication');
  check(JSON.stringify(camera.marks)===history,'Mode, source, and camera tests leave stored history intact');
  const stable=draw(),again=draw();check(stable.every((v,i)=>v===again[i]),'Unchanged input has identical rendered pixels');
  // Compile the production selector independently to inspect exact edge choices.
  // Full renderer portrait comparisons below additionally exercise the Lines branch.
  const gl=rainCameraGPU.gl;
  const selector=rainCameraGPU.program('attribute vec2 corner;void main(){gl_Position=vec4(corner*2.-1.,0.,1.);}',
   'precision highp float;uniform sampler2D mediaImage;uniform lowp int mediaCharacters;uniform mediump float mediaDotAmount,mediaShadeCount;uniform vec4 testRect;'+character.selectionGLSL+'void main(){gl_FragColor=vec4((chooseMediaPattern(testRect)-256.)/255.,0.,0.,1.);}', ['corner']);
  const tex=rainCameraGPU.texture(),fbo=gl.createFramebuffer();gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
  gl.useProgram(selector);gl.viewport(0,0,1,1);gl.disable(gl.BLEND);gl.bindBuffer(gl.ARRAY_BUFFER,rainCameraGPU.corners);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  const u=rainCameraGPU.uniforms(selector,['mediaImage','mediaCharacters','mediaDotAmount','mediaShadeCount','testRect']);
  gl.uniform1i(u.mediaImage,2);gl.uniform1i(u.mediaCharacters,3);gl.uniform1f(u.mediaDotAmount,.5);gl.uniform1f(u.mediaShadeCount,atlas.shades.length);
  const region=rect('shading');gl.uniform4f(u.testRect,region.x/400,region.y/400,region.w/400,region.h/400);
  for(const [values,char] of [[[0,0,0,0,0,0,1,1,1],'_'],[[0,0,1,0,0,1,0,0,1],'|'],[[0,1,1,0,0,1,0,0,0],'\\'],[[1,1,0,1,0,0,0,0,0],'/']]){
   for(let i=0;i<9;i++){ctx.fillStyle=values[i]?'#c0c0c0':'#404040';ctx.fillRect(region.x+(i%3-1)*region.w,region.y+(Math.floor(i/3)-1)*region.h,region.w,region.h);}
   revision++;gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,rainCameraGPU.mediaTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
   const selected=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,selected);check(selected[0]===atlas.shades.findIndex(g=>g.char===char),'GPU Lines follows '+char+' contour tangent');
  }
  gl.deleteFramebuffer(fbo);gl.deleteTexture(tex);gl.deleteProgram(selector);
  setMode('braille');
  const originalDpr=Object.getOwnPropertyDescriptor(window,'devicePixelRatio');let proofDpr=2;
  Object.defineProperty(window,'devicePixelRatio',{get:()=>proofDpr,configurable:true});
  for(const size of [[400,400],[640,360]]){
   matrixCanvas.width=source.width=size[0];matrixCanvas.height=source.height=size[1];
   window.matrixRainRendering.quality='sharp';pattern(71);check(readMask(draw())===71,'Correct pixel registration at DPR 2 and viewport '+size.join('x'));
  }
  if(originalDpr)Object.defineProperty(window,'devicePixelRatio',originalDpr);else delete window.devicePixelRatio;
  matrixCanvas.width=source.width=400;matrixCanvas.height=source.height=400;window.matrixRainRendering.quality='low';pattern(184);
  const beforeLoss=draw(),extension=rainCameraGPU.gl.getExtension('WEBGL_lose_context');
  if(extension){
   extension.loseContext();for(let n=0;!rainCameraGPU.lost&&n<100;n++)await sleep(10);
   extension.restoreContext();for(let n=0;rainCameraGPU.lost&&n<100;n++)await sleep(10);
   const restored=draw();check(restored.every((v,i)=>v===beforeLoss[i]),'Context restoration reloads current pattern and RGB textures');
  }
  check(rainCameraGPU.gl.getError()===rainCameraGPU.gl.NO_ERROR,'No WebGL errors');
  // Actual public-domain portrait through the same production GPU, same world marks.
  const portrait=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src='tests/media-fixtures/astronaut.png';});
  matrixCanvas.width=source.width=512;matrixCanvas.height=source.height=512;ctx.drawImage(portrait,0,0,512,512);revision++;
  camera.marks=[];
  for(let y=12;y<512;y+=13)for(let x=4;x<512;x+=10)camera.marks.push({...mark,char:'アイウエオカキクケコ'[(x+y)%10],x:x-256,y:y-256,z:500,fontSize:14,rgb:[0,1,0]});
  const group=document.createElement('div');group.style.cssText='display:flex;flex-wrap:wrap;gap:8px';document.body.append(group);report.portrait={};
  for(const mode of ['original','shading','braille','lines']){
   setMode(mode);rainCameraGPU.invalidate=true;draw();
   const submit=[],complete=[];
   for(let n=0;n<12;n++){const start=performance.now();rainCameraGPU.render(camera,1);const sent=performance.now();rainCameraGPU.gl.finish();submit.push(sent-start);complete.push(performance.now()-sent);}
   const median=list=>list.sort((a,b)=>a-b)[list.length>>1];report.portrait[mode]={cpuSubmissionMedianMs:median(submit),gpuFinishWaitMedianMs:median(complete),marks:camera.marks.length};
   const box=document.createElement('div'),label=document.createElement('p'),image=document.createElement('canvas');label.textContent=mode;image.width=image.height=512;image.getContext('2d').drawImage(rainCameraGPU.canvas,0,0);box.append(label,image);group.append(box);
  }
  check(true,'Public-domain portrait rendered through all four modes on identical world marks');
  report.sampling=rainCameraGPU.pictureVertexSampling?'vertex':'fragment';report.passed=true;
 }catch(error){report.errors.push(error.stack||String(error));report.passed=false;}
 output.textContent=JSON.stringify(report,null,2);output.dataset.passed=String(report.passed);
})();
