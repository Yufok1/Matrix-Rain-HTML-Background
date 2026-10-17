// Immutable world history; upload births and age/present on the GPU.
// MSDF coverage adapts Rezmason/matrix (MIT). See assets/THIRD-PARTY.md.
const rainCameraGPU = {
    canvas:null,gl:null,initialized:false,failed:false,lost:false,invalidate:true,
    fonts:new Map(),glyphs:new Map(),colors:new Map(),stats:{},stride:22,
    capacity:16384,used:0,write:0,batches:[],batchFirst:0,
    program(vertex,fragment,names){
        const gl=this.gl,p=gl.createProgram();
        for(const [type,source]of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
            const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
            if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);gl.deleteShader(s);
        }
        names.forEach((name,i)=>gl.bindAttribLocation(p,i,name));gl.linkProgram(p);
        if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;
    },
    uniforms(program,names){return Object.fromEntries(names.map(name=>[name,this.gl.getUniformLocation(program,name)]));},
    texture(){
        const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
        for(const parameter of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,parameter,gl.LINEAR);
        for(const parameter of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,parameter,gl.CLAMP_TO_EDGE);return t;
    },
    init(){
        if(this.failed||this.lost)return false;if(this.initialized)return true;
        try{
            if(!this.canvas){
                const canvas=this.canvas=document.createElement('canvas');
                canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;opacity:.8;display:none;background:#000';document.body.appendChild(canvas);
                canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.lost=true;this.hide();});
                canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.initialized=false;this.failed=false;this.postFailed=false;this.invalidate=true;this.targets=null;this.glyphs.clear();this.colors.clear();this.fontReady=false;});
            }
            const gl=this.gl=this.canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,preserveDrawingBuffer:new URLSearchParams(location.search).has('audit')});
            if(!gl)throw new Error('WebGL unavailable');this.instances=gl.getExtension('ANGLE_instanced_arrays');if(!this.instances)throw new Error('Instancing unavailable');
            this.derivatives=!!gl.getExtension('OES_standard_derivatives');this.maxSize=gl.getParameter(gl.MAX_TEXTURE_SIZE);
            this.pictureVertexSampling=gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)>0&&!new URLSearchParams(location.search).has('picture-fragment');
            // Wallpaper/iOS builds omit media depiction. GLSL still resolves
            // functions inside disabled branches, so supply the neutral selector
            // when that optional module is absent.
            const pictureSelection=window.RainMediaCharacters?.selectionGLSL||'float chooseMediaPattern(vec4 rect){return 0.;}';
            this.main=this.program(`
                attribute vec2 corner;attribute vec4 point,color,atlasRect,shape;attribute vec2 lifetime;attribute vec3 delta;attribute float format;
                uniform vec3 cell,rowX,rowY,rowZ;uniform vec2 viewport,range;uniform float focal,ageNow,phase,perspective;uniform bool smoothMotion,stepped,variety;
                varying vec2 uv;varying vec4 tint;varying float glyphFormat,imagePotential;
                uniform bool mediaLive;uniform lowp int mediaCharacters;uniform sampler2D mediaImage;uniform mediump float mediaDotAmount,mediaShadeCount;
                varying vec2 pictureLocal;varying vec4 pictureRect;varying float pictureIndex;
                ${this.pictureVertexSampling?pictureSelection:''}
                float level(float p){float s=floor(p*8.);if(s<1.)return 1.;if(s<2.)return .68;if(s<3.)return .45;if(s<4.)return .29;if(s<5.)return .18;if(s<6.)return .105;if(s<7.)return .06;return .032;}
                void main(){
                    float age=mod(ageNow-lifetime.x+4096.,4096.),length=variety?lifetime.y:40.;
                    if(age>=length){gl_Position=vec4(2.,2.,2.,1.);uv=vec2(0.);tint=vec4(0.);glyphFormat=mod(format,2.);imagePotential=0.;pictureLocal=vec2(0.);pictureRect=vec4(0.);pictureIndex=0.;return;}
                    float p=age/length,fade=stepped?level(p):(variety?exp(-4.*p)*(1.-p):pow(.88,age));
                    vec3 location=point.xyz;if(smoothMotion&&age<.5)location-=delta*(1.-phase);
                    vec3 world=location+cell-vec3(0.,0.,focal);
                    vec3 view=vec3(dot(rowX,world),dot(rowY,world),dot(rowZ,world)+focal);
                    float projectedDepth=mix(focal,view.z,perspective);
                    vec4 bounds=shape;
                    if(mediaLive&&mediaCharacters>0)bounds=mediaCharacters==2?vec4(0.,-.8,.6,0.):vec4(-.05,-.85,.65,.25);
                    vec2 offset=vec2(mix(bounds.x,bounds.z,corner.x),mix(bounds.y,bounds.w,corner.y))*point.w;
                    pictureLocal=corner;pictureIndex=0.;
                    pictureRect=vec4(vec2(.5)+(view.xy+bounds.xy*point.w)*focal/(viewport*projectedDepth),(bounds.zw-bounds.xy)*point.w*focal/(viewport*projectedDepth));
                    ${this.pictureVertexSampling?'if(mediaLive&&mediaCharacters>0&&view.z>range.x&&view.z<range.y&&pictureRect.x<1.&&pictureRect.y<1.&&pictureRect.x+pictureRect.z>0.&&pictureRect.y+pictureRect.w>0.)pictureIndex=chooseMediaPattern(pictureRect);':''}
                    vec2 pixel=(view.xy+offset)*vec2(2.*focal/viewport.x,-2.*focal/viewport.y);
                    float nearW=mix(focal,range.x,perspective),farW=mix(focal,range.y,perspective);
                    float z=(nearW+farW)/(range.y-range.x)*(view.z-range.x)-nearW;
                    gl_Position=vec4(pixel,z,projectedDepth);
                    uv=mix(atlasRect.xy,atlasRect.zw,corner);glyphFormat=mod(format,2.);
                    float frustum=smoothstep(range.x,range.x+40.,view.z)*(1.-smoothstep(range.y-300.,range.y,view.z));
                    tint=vec4(color.rgb,color.a*fade*frustum);
                    imagePotential=color.a*pow(fade,.18)*frustum;
                }`,`${this.derivatives?'#extension GL_OES_standard_derivatives : enable\n':''}
                #ifdef GL_FRAGMENT_PRECISION_HIGH
                precision highp float;
                #else
                precision mediump float;
                #endif
                uniform sampler2D msdf,raster,mediaImage;uniform vec2 atlasSize,mediaViewport;uniform float pxRange,mediaInfluence;uniform bool mediaLive;varying vec2 uv;varying vec4 tint;varying float glyphFormat,imagePotential;
                uniform sampler2D pictureAtlas;uniform lowp int mediaCharacters;uniform mediump float mediaDotAmount,mediaShadeCount;uniform vec2 pictureGrid;uniform float pictureInset;
                varying vec2 pictureLocal;varying vec4 pictureRect;varying float pictureIndex;
                ${this.pictureVertexSampling?'':pictureSelection}
                float median3(vec3 v){return max(min(v.r,v.g),min(max(v.r,v.g),v.b));}
                void main(){float a;
                    float strength=0.,mediaCoverage=0.;
                    vec3 ink=tint.rgb;
                    if(mediaLive){
                        // Sample within each letter, not once for a huge glyph.
                        // Picture detail follows screen pixels across all cells.
                        vec2 imageUV=vec2(gl_FragCoord.x/mediaViewport.x,1.-gl_FragCoord.y/mediaViewport.y);
                        vec4 picture=texture2D(mediaImage,imageUV);
                        mediaCoverage=picture.a*mediaInfluence;
                        strength=dot(picture.rgb,vec3(.2126,.7152,.0722))*picture.a;
                        ink=mix(ink,picture.rgb,picture.a*mediaInfluence);
                    }
                    float emphasis=strength*mediaInfluence;
                    if(mediaLive&&mediaCharacters>0){
                        float index=${this.pictureVertexSampling?'floor(pictureIndex+.5)':'chooseMediaPattern(pictureRect)'};
                        vec2 glyphCell=vec2(mod(index,pictureGrid.x),floor(index/pictureGrid.x));
                        vec2 pictureUV=(glyphCell+mix(vec2(pictureInset),vec2(1.-pictureInset),pictureLocal))/pictureGrid;
                        a=texture2D(pictureAtlas,pictureUV).a;
                    }else{
                    ${this.derivatives?`if(glyphFormat>.5){vec2 screenTexSize=vec2(1.)/max(fwidth(uv),vec2(.000001));float scale=max(.5*dot(vec2(pxRange)/atlasSize,screenTexSize),1.);a=clamp(scale*(median3(texture2D(msdf,uv).rgb)-.5+emphasis*.10)+.5,0.,1.);}else`:''}
                    {a=texture2D(raster,uv).a;}
                    }
                    // Media supplies its own RGB ink.
                    // Preserve the approved media visibility curve. Trail lifetime
                    // still controls when each glyph disappears.
                    // Video RGB already contains the scene's luminance. Using
                    // that luminance as opacity darkens its colors a second time.
                    float visibility=mediaLive?mediaCoverage:emphasis;
                    float alpha=tint.a+(1.-tint.a)*clamp(visibility*imagePotential*1.8,0.,1.);
                    if(a*alpha<.003)discard;gl_FragColor=vec4(ink,alpha*a);
                }`,['corner','point','color','atlasRect','shape','lifetime','delta','format']);
            this.u=this.uniforms(this.main,['cell','rowX','rowY','rowZ','viewport','range','focal','ageNow','phase','perspective','smoothMotion','stepped','variety','msdf','raster','atlasSize','pxRange','mediaImage','mediaLive','mediaViewport','mediaInfluence']);
            Object.assign(this.u,this.uniforms(this.main,['pictureAtlas','mediaCharacters','mediaDotAmount','mediaShadeCount','pictureGrid','pictureInset']));
            this.corners=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.corners);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),gl.STATIC_DRAW);
            this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.capacity*this.stride*4,gl.DYNAMIC_DRAW);this.staging=new Float32Array(this.capacity*this.stride);
            this.msdfTexture=this.texture();gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
            this.rasterTexture=this.texture();this.atlas=document.createElement('canvas');this.atlas.width=this.atlas.height=Math.min(1536,this.maxSize);this.grid=Math.floor(this.atlas.width/96);this.ctx=this.atlas.getContext('2d');this.ctx.font='64px monospace';this.ctx.fillStyle='#fff';this.rasterDirty=true;
            this.mediaTexture=this.texture();gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));this.mediaRevision=-1;
            this.pictureTexture=this.texture();gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));this.pictureRevision=-1;
            const c=document.createElement('canvas');c.width=c.height=1;this.colorCtx=c.getContext('2d',{willReadFrequently:true});this.glyph('�');
            this.fontReady=false;this.loadFont();this.initPost();this.initialized=true;this.invalidate=true;return true;
        }catch(error){this.failed=true;this.hide();console.warn('3D renderer unavailable; using Original View.',error.message);return false;}
    },
    loadFont(){
        const metadata=window.RainMSDF;if(!metadata||!this.derivatives)return;this.fonts.clear();
        for(const variant of metadata.variants||[metadata])for(const glyph of variant.glyphs){
            if(!glyph.atlasBounds||!glyph.planeBounds)continue;const a=glyph.atlasBounds,p=glyph.planeBounds;
            this.fonts.set(String.fromCodePoint(glyph.unicode),{uv:[a.left/metadata.atlas.width,a.top/metadata.atlas.height,a.right/metadata.atlas.width,a.bottom/metadata.atlas.height],shape:[p.left,-p.top,p.right,-p.bottom],mode:1});
        }
        this.fontInfo=metadata.atlas;const img=new Image();img.onload=()=>{
            if(this.lost||this.failed)return;const gl=this.gl;
            try{gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.msdfTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
                gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);this.fontReady=true;this.invalidate=true;
            }catch(error){console.warn('Sharp atlas unavailable; using browser glyphs.',error.message);}
            finally{gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);}
        };img.onerror=()=>console.warn('Sharp font atlas did not load; using browser glyphs.');img.src='assets/rain-font-msdf.png';
    },
    glyph(char){
        if(this.fontReady&&window.matrixRainRendering.sharp!==false&&this.fonts.has(char))return this.fonts.get(char);if(this.glyphs.has(char))return this.glyphs.get(char);
        if(this.glyphs.size>=this.grid*this.grid){
            const size=Math.min(this.maxSize,4096,this.atlas.width*2);if(size<=this.atlas.width)return this.glyphs.get('�');
            this.atlas.width=this.atlas.height=size;this.grid=Math.floor(size/96);this.ctx.font='64px monospace';this.ctx.fillStyle='#fff';for(const [value,record]of this.glyphs)this.paintGlyph(value,record);this.invalidate=true;
        }
        const record={index:this.glyphs.size,uv:[0,0,0,0],shape:[0,-1,1.5,.5],mode:0};this.glyphs.set(char,record);this.paintGlyph(char,record);return record;
    },
    paintGlyph(char,record){const x=record.index%this.grid*96,y=Math.floor(record.index/this.grid)*96;this.ctx.fillText(char,x,y+64);record.uv=[x/this.atlas.width,y/this.atlas.height,(x+96)/this.atlas.width,(y+96)/this.atlas.height];this.rasterDirty=true;},
    color(css){
        if(this.colors.has(css))return this.colors.get(css);let rgb;
        if(/^#[\da-f]{6}$/i.test(css))rgb=[parseInt(css.slice(1,3),16)/255,parseInt(css.slice(3,5),16)/255,parseInt(css.slice(5,7),16)/255];
        else{this.colorCtx.clearRect(0,0,1,1);this.colorCtx.fillStyle=css;this.colorCtx.fillRect(0,0,1,1);const p=this.colorCtx.getImageData(0,0,1,1).data;rgb=[p[0]/255,p[1]/255,p[2]/255];}
        if(this.colors.size>2048)this.colors.clear();this.colors.set(css,rgb);return rgb;
    },
    bindInstances(start,buffer=this.buffer){
        const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.corners);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);this.instances.vertexAttribDivisorANGLE(0,0);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
        for(const [index,count,offset]of [[1,4,0],[2,4,4],[3,4,8],[4,4,12],[5,2,16],[6,3,18],[7,1,21]]){gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,count,gl.FLOAT,false,this.stride*4,(start*this.stride+offset)*4);this.instances.vertexAttribDivisorANGLE(index,1);}
    },
    pack(mark,index,target=this.staging,slot=(this.write+index)%this.capacity){
        const glyph=this.glyph(mark.char),rgb=mark.rgb||(mark.rgb=this.color(mark.color)),v=target;let n=index*this.stride;
        v[n++]=mark.x;v[n++]=mark.y;v[n++]=mark.z;v[n++]=mark.fontSize;v[n++]=rgb[0];v[n++]=rgb[1];v[n++]=rgb[2];v[n++]=mark.alpha;
        for(const value of glyph.uv)v[n++]=value;for(const value of glyph.shape)v[n++]=value;v[n++]=mark.frame%4096;v[n++]=mark.trailLength;for(const value of mark.delta)v[n++]=value;
        v[n]=glyph.mode;
    },
    upload(marks){
        if(!marks.length)return 0;const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);for(let i=0;i<marks.length;i++)this.pack(marks[i],i);
        const first=Math.min(marks.length,this.capacity-this.write);gl.bufferSubData(gl.ARRAY_BUFFER,this.write*this.stride*4,this.staging.subarray(0,first*this.stride));
        if(first<marks.length)gl.bufferSubData(gl.ARRAY_BUFFER,0,this.staging.subarray(first*this.stride,marks.length*this.stride));
        let i=0;while(i<marks.length){const frame=marks[i].frame,start=i;let maxLife=0;while(i<marks.length&&marks[i].frame===frame){maxLife=Math.max(maxLife,marks[i].trailLength);i++;}this.batches.push({frame,start:(this.write+start)%this.capacity,count:i-start,maxLife});}
        this.write=(this.write+marks.length)%this.capacity;this.used+=marks.length;return marks.length*this.stride*4;
    },
    expire(now,variety){
        while(this.batchFirst<this.batches.length){const batch=this.batches[this.batchFirst];if(now-batch.frame<(variety?batch.maxLife:40))break;this.used-=batch.count;this.batchFirst++;}
        if(this.batchFirst>256){this.batches=this.batches.slice(this.batchFirst);this.batchFirst=0;}
    },
    rebuild(camera){
        const required=Math.max(16384,camera.marks.length*2);if(this.capacity<required){while(this.capacity<required)this.capacity*=2;this.staging=new Float32Array(this.capacity*this.stride);this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.buffer);this.gl.bufferData(this.gl.ARRAY_BUFFER,this.capacity*this.stride*4,this.gl.DYNAMIC_DRAW);}
        this.used=0;this.write=0;this.batches.length=0;this.batchFirst=0;this.invalidate=false;this.lastCompact=camera.frame;const bytes=this.upload(camera.marks);camera.pending.length=0;return bytes;
    },
    tileVisible(camera,tile){
        if(camera.mediaDepiction||this.disableCull)return true;const b=camera.bounds;if(!b)return false;const r=camera.rotation;
        const x=b.center[0]+tile.offset[0],y=b.center[1]+tile.offset[1],z=b.center[2]+tile.offset[2]-rainFocalLength;
        const vx=r[0]*x+r[1]*y+r[2]*z,vy=r[3]*x+r[4]*y+r[5]*z,vz=r[6]*x+r[7]*y+r[8]*z+rainFocalLength;
        const sx=matrixCanvas.width/(2*rainFocalLength),sy=matrixCanvas.height/(2*rainFocalLength);
        const mix=camera.continuous?camera.perspective:1,px=matrixCanvas.width/2*(1-mix),py=matrixCanvas.height/2*(1-mix);
        for(const [a,c,d,e]of [[1,0,sx*mix,px],[-1,0,sx*mix,px],[0,1,sy*mix,py],[0,-1,sy*mix,py],[0,0,1,-camera.near],[0,0,-1,camera.far]]){
            const extent=Math.abs(a*r[0]+c*r[3]+d*r[6])*b.half[0]+Math.abs(a*r[1]+c*r[4]+d*r[7])*b.half[1]+Math.abs(a*r[2]+c*r[5]+d*r[8])*b.half[2]+b.pad*(Math.abs(a)+Math.abs(c));
            if(a*vx+c*vy+d*vz+e+extent<0)return false;
        }return true;
    },
    render(camera,phase=1){
        const started=performance.now();if(!this.init())return;const gl=this.gl,options=window.matrixRainRendering,width=matrixCanvas.width,height=matrixCanvas.height;
        const age=Math.max(0,camera.frame-1),trails=window.matrixRainTrails;this.expire(age,trails?.enabled!==false);let uploaded=0;
        // Unequal lifetimes leave holes inside a birth batch. Compact occasionally
        // when those dead slots would cost more than an amortized history upload.
        const compact=camera.frame-(this.lastCompact||0)>=8&&this.used>camera.marks.length*1.15;
        if(this.invalidate||compact||this.used+camera.pending.length>this.capacity)uploaded+=this.rebuild(camera);else{uploaded+=this.upload(camera.pending);camera.pending.length=0;}
        if(this.invalidate)uploaded+=this.rebuild(camera);

        gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.rasterTexture);if(this.rasterDirty){gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.atlas);this.rasterDirty=false;}
        const dpr=Math.max(1,window.devicePixelRatio||1),cap=options.quality==='low'?1:options.quality==='sharp'?2:(width<=700?1.5:2),budget=options.quality==='sharp'?12000000:6000000;
        const ratio=Math.min(dpr,cap,Math.sqrt(budget/(width*height)),this.maxSize/width,this.maxSize/height),pw=Math.max(1,Math.floor(width*ratio)),ph=Math.max(1,Math.floor(height*ratio));
        if(this.canvas.width!==pw||this.canvas.height!==ph){this.canvas.width=pw;this.canvas.height=ph;}this.canvas.style.display='block';matrixCanvas.style.visibility='hidden';
        const glow=Math.max(0,Math.min(1,Number(options.glow)||0)),contrast=Math.max(.75,Math.min(1.5,Number(options.contrast)||1));let post=!this.postFailed&&(glow>0||contrast!==1);
        if(post)try{this.ensureTargets(pw,ph);}catch(error){this.postFailed=true;post=false;console.warn('Glow unavailable; continuing without postprocessing.',error.message);}
        gl.bindFramebuffer(gl.FRAMEBUFFER,post?this.targets.scene.fbo:null);gl.viewport(0,0,pw,ph);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.useProgram(this.main);
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.msdfTexture);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.rasterTexture);
        const u=this.u,r=camera.rotation;gl.uniform1i(u.msdf,0);gl.uniform1i(u.raster,1);gl.uniform2f(u.atlasSize,this.fontInfo?.width||1,this.fontInfo?.height||1);gl.uniform1f(u.pxRange,this.fontInfo?.distanceRange||6);
        const media=window.rainMedia,live=media?.active,frame=live?media.frame:null;
        gl.uniform1i(u.mediaImage,2);gl.uniform1i(u.mediaLive,!!frame);
        gl.uniform2f(u.mediaViewport,pw,ph);gl.uniform1f(u.mediaInfluence,media?.active?media.options.influence/100:0);
        gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.mediaTexture);
        if(frame){
            if(frame.revision!==this.mediaRevision){gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,frame.canvas);this.mediaRevision=frame.revision;}
        }
        const characters=window.RainMediaCharacters,atlas=window.RainMediaGlyphAtlas;
        const pictureMode=frame&&characters?.image&&atlas?characters.number():0;
        gl.uniform1i(u.pictureAtlas,3);gl.uniform1i(u.mediaCharacters,pictureMode);
        gl.uniform1f(u.mediaDotAmount,(characters?.density??50)/100);gl.uniform1f(u.mediaShadeCount,atlas?.shades.length||1);
        gl.uniform2f(u.pictureGrid,atlas?.cols||1,atlas?.rows||1);gl.uniform1f(u.pictureInset,atlas?atlas.pad/atlas.tile:0);
        gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,this.pictureTexture);
        if(characters?.image&&this.pictureRevision!==characters.revision){gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,characters.image);this.pictureRevision=characters.revision;}
        gl.uniform3f(u.rowX,r[0],r[1],r[2]);gl.uniform3f(u.rowY,r[3],r[4],r[5]);gl.uniform3f(u.rowZ,r[6],r[7],r[8]);gl.uniform2f(u.viewport,width,height);gl.uniform1f(u.focal,rainFocalLength);gl.uniform2f(u.range,camera.near,camera.far);
        gl.uniform1f(u.perspective,camera.continuous?camera.perspective:1);
        gl.uniform1f(u.ageNow,age%4096);gl.uniform1f(u.phase,Math.max(0,Math.min(1,phase)));gl.uniform1i(u.smoothMotion,options.smooth!==false);gl.uniform1i(u.stepped,trails?.stepped!==false);gl.uniform1i(u.variety,trails?.enabled!==false);

        const start=this.batches[this.batchFirst]?.start||0,first=Math.min(this.used,this.capacity-start);let cells=0;
        for(let ti=0;ti<camera.tiles.length;ti++){const tile=camera.tiles[ti];if(!this.tileVisible(camera,tile))continue;cells++;gl.uniform3fv(u.cell,tile.offset);if(first){this.bindInstances(start);this.instances.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP,0,4,first);}if(first<this.used){this.bindInstances(0);this.instances.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP,0,4,this.used-first);}}
        gl.uniform1i(u.mediaLive,false);gl.uniform1f(u.mediaInfluence,0);
        if(post)this.post(glow,contrast,pw,ph);
        this.stats={cells,selectedCells:camera.tiles.length,marks:camera.marks.length,gpuSlots:this.used,instances:cells*this.used,cpuMs:performance.now()-started,uploadedBytes:uploaded,sharp:this.fontReady&&options.sharp!==false,pixelRatio:ratio,size:[pw,ph],glow,phase};
        const mediaOutput=document.getElementById('media-assembly-status');if(mediaOutput){mediaOutput.dataset.gpuCpuMs=this.stats.cpuMs.toFixed(2);mediaOutput.dataset.worldMarks=String(camera.marks.length);mediaOutput.dataset.cells=String(cells);mediaOutput.dataset.characterMode=pictureMode?characters.mode:'original';mediaOutput.dataset.patternSampling=this.pictureVertexSampling?'vertex':'fragment';}
        if(this.auditCapture){this.auditCapture(this.canvas);this.auditCapture=null;}
    },
    initPost(){
        const vertex='attribute vec2 corner;varying vec2 uv;void main(){uv=corner;gl_Position=vec4(corner*2.-1.,0.,1.);}';
        this.blur=this.program(vertex,`precision mediump float;varying vec2 uv;uniform sampler2D source;uniform vec2 stepSize;uniform bool threshold;
            vec3 sample(vec2 p){vec3 c=texture2D(source,p).rgb;if(threshold){float m=max(c.r,max(c.g,c.b));c*=max(0.,m-.12)/max(m,.0001);}return c;}
            void main(){vec3 c=sample(uv)*.227027;c+=(sample(uv+stepSize*1.384615)+sample(uv-stepSize*1.384615))*.316216;c+=(sample(uv+stepSize*3.230769)+sample(uv-stepSize*3.230769))*.070270;gl_FragColor=vec4(c,1.);}`,['corner']);
        this.combine=this.program(vertex,`precision mediump float;varying vec2 uv;uniform sampler2D scene,bloom;uniform float strength,contrast;
            void main(){vec3 c=texture2D(scene,uv).rgb+texture2D(bloom,uv).rgb*strength*.8;c=pow(max(c,vec3(0.)),vec3(contrast));gl_FragColor=vec4(c,1.);}`,['corner']);
        this.bu=this.uniforms(this.blur,['source','stepSize','threshold']);this.cu=this.uniforms(this.combine,['scene','bloom','strength','contrast']);
    },
    target(width,height){
        const gl=this.gl,tex=this.texture(),fbo=gl.createFramebuffer();gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){gl.deleteTexture(tex);gl.deleteFramebuffer(fbo);throw new Error('Incomplete glow target');}return {tex,fbo,width,height};
    },
    ensureTargets(width,height){
        if(this.targets?.scene.width===width&&this.targets.scene.height===height)return;const gl=this.gl;if(this.targets)for(const t of Object.values(this.targets)){gl.deleteTexture(t.tex);gl.deleteFramebuffer(t.fbo);}
        const next={};this.targets=null;
        try{next.scene=this.target(width,height);next.h=this.target(Math.max(1,width>>2),Math.max(1,height>>2));next.v=this.target(Math.max(1,width>>2),Math.max(1,height>>2));this.targets=next;}
        catch(error){for(const t of Object.values(next)){gl.deleteTexture(t.tex);gl.deleteFramebuffer(t.fbo);}throw error;}
    },
    quad(){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.corners);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);this.instances.vertexAttribDivisorANGLE(0,0);for(let i=1;i<8;i++)gl.disableVertexAttribArray(i);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);},
    post(strength,contrast,width,height){
        const gl=this.gl,t=this.targets;gl.disable(gl.BLEND);gl.activeTexture(gl.TEXTURE0);gl.useProgram(this.blur);gl.uniform1i(this.bu.source,0);
        gl.bindFramebuffer(gl.FRAMEBUFFER,t.h.fbo);gl.viewport(0,0,t.h.width,t.h.height);gl.bindTexture(gl.TEXTURE_2D,t.scene.tex);gl.uniform2f(this.bu.stepSize,1/t.h.width,0);gl.uniform1i(this.bu.threshold,1);this.quad();
        gl.bindFramebuffer(gl.FRAMEBUFFER,t.v.fbo);gl.bindTexture(gl.TEXTURE_2D,t.h.tex);gl.uniform2f(this.bu.stepSize,0,1/t.v.height);gl.uniform1i(this.bu.threshold,0);this.quad();
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,width,height);gl.useProgram(this.combine);gl.bindTexture(gl.TEXTURE_2D,t.scene.tex);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,t.v.tex);
        gl.uniform1i(this.cu.scene,0);gl.uniform1i(this.cu.bloom,1);gl.uniform1f(this.cu.strength,strength);gl.uniform1f(this.cu.contrast,contrast);this.quad();
    },
    hide(){if(this.canvas)this.canvas.style.display='none';if(matrixCanvas)matrixCanvas.style.visibility='visible';}
};
