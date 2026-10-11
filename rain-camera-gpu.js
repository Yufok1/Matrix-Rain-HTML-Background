// Camera-only renderer: world-cell translations precede one shared projection.
const rainCameraGPU = {
    canvas: null, gl: null, glyphs: new Map(), colors: new Map(), vertices: new Float32Array(90000), stats: {},
    init() {
        if (this.canvas) return;
        const canvas = this.canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;opacity:.8;display:none;background:#000';
        document.body.appendChild(canvas);
        const gl = this.gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false,
            preserveDrawingBuffer: new URLSearchParams(location.search).has('audit') });
        if (!gl) throw new Error('Camera preview requires WebGL');
        this.instances = gl.getExtension('ANGLE_instanced_arrays');
        if (!this.instances) throw new Error('Camera preview requires GPU instancing');
        const shader = (type, source) => {
            const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
            return s;
        };
        const program = this.program = gl.createProgram();
        gl.attachShader(program, shader(gl.VERTEX_SHADER, `
            attribute vec2 corner; attribute vec3 position; attribute float size;
            attribute float glyph; attribute vec4 color;
            uniform vec3 cell; uniform vec3 rowX; uniform vec3 rowY; uniform vec3 rowZ;
            uniform vec2 viewport; uniform float focal; uniform vec2 range;
            varying vec2 uv; varying vec4 tint;
            void main() {
                vec3 world=position+cell-vec3(0.,0.,focal);
                vec3 view=vec3(dot(rowX,world),dot(rowY,world),dot(rowZ,world)+focal);
                vec2 glyphCorner=vec2(corner.x*1.5,corner.y*1.5-1.)*size;
                vec2 pixel=(view.xy+glyphCorner)*vec2(2.*focal/viewport.x,-2.*focal/viewport.y);
                float z=(range.y+range.x)/(range.y-range.x)*view.z-2.*range.y*range.x/(range.y-range.x);
                gl_Position=vec4(pixel,z,view.z);
                uv=(vec2(mod(glyph,16.),floor(glyph/16.))+corner)/16.;
                // Fade at the camera's near/far limits, never at a cell seam.
                tint=vec4(color.rgb,color.a*smoothstep(range.x,range.x+40.,view.z)*(1.-smoothstep(range.y-300.,range.y,view.z)));
            }`));
        gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `
            precision mediump float; uniform sampler2D atlas; varying vec2 uv; varying vec4 tint;
            void main(){float a=texture2D(atlas,uv).a;if(a*tint.a<.003)discard;gl_FragColor=vec4(tint.rgb,tint.a*a);}`));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
        gl.useProgram(program);
        const corners=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,corners);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]),gl.STATIC_DRAW);
        const corner=gl.getAttribLocation(program,'corner');gl.enableVertexAttribArray(corner);
        gl.vertexAttribPointer(corner,2,gl.FLOAT,false,0,0);
        this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
        for (const [name,count,offset] of [['position',3,0],['size',1,3],['glyph',1,4],['color',4,5]]) {
            const location=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(location,count,gl.FLOAT,false,36,offset*4);
            this.instances.vertexAttribDivisorANGLE(location,1);
        }
        this.uniforms={};
        for(const name of ['cell','rowX','rowY','rowZ','viewport','focal','range'])this.uniforms[name]=gl.getUniformLocation(program,name);
        this.atlas=document.createElement('canvas');this.atlas.width=this.atlas.height=1536;
        this.ctx=this.atlas.getContext('2d');this.ctx.font='64px monospace';this.ctx.fillStyle='#fff';
        this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
        const c=document.createElement('canvas');c.width=c.height=1;this.colorCtx=c.getContext('2d',{willReadFrequently:true});
    },
    color(css) {
        if(this.colors.has(css))return this.colors.get(css);
        this.colorCtx.clearRect(0,0,1,1);this.colorCtx.fillStyle=css;this.colorCtx.fillRect(0,0,1,1);
        const p=this.colorCtx.getImageData(0,0,1,1).data,rgb=[p[0]/255,p[1]/255,p[2]/255];
        if(this.colors.size>512)this.colors.clear();this.colors.set(css,rgb);return rgb;
    },
    render(camera) {
        const started=performance.now();
        this.init();const gl=this.gl,width=matrixCanvas.width,height=matrixCanvas.height,u=this.uniforms;
        this.canvas.style.display='block';matrixCanvas.style.visibility='hidden';
        if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;gl.viewport(0,0,width,height);}
        gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
        let dirty=false,n=0;
        if(this.vertices.length<camera.marks.length*9)this.vertices=new Float32Array(camera.marks.length*18);
        for(const mark of camera.marks){
            const alpha=mark.alpha*(window.matrixRainTrails?.alpha(mark.trailLength, camera.frame-mark.frame) ?? Math.pow(.88,camera.frame-mark.frame));
            if(alpha<.01)continue;
            if(!this.glyphs.has(mark.char)&&this.glyphs.size<256){
                const i=this.glyphs.size;this.glyphs.set(mark.char,i);
                this.ctx.fillText(mark.char,(i%16)*96,Math.floor(i/16)*96+64);dirty=true;
            }
            const rgb=this.color(mark.color),v=this.vertices;
            v[n++]=mark.x;v[n++]=mark.y;v[n++]=mark.z;v[n++]=mark.fontSize;v[n++]=this.glyphs.get(mark.char)||0;
            v[n++]=rgb[0];v[n++]=rgb[1];v[n++]=rgb[2];v[n++]=alpha;
        }
        if(dirty)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.atlas);
        gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bufferData(gl.ARRAY_BUFFER,this.vertices.subarray(0,n),gl.DYNAMIC_DRAW);
        const r=camera.rotation;
        gl.uniform3f(u.rowX,r[0],r[1],r[2]);gl.uniform3f(u.rowY,r[3],r[4],r[5]);gl.uniform3f(u.rowZ,r[6],r[7],r[8]);
        gl.uniform2f(u.viewport,width,height);gl.uniform1f(u.focal,rainFocalLength);gl.uniform2f(u.range,camera.near,camera.far);
        for(const tile of camera.tiles){gl.uniform3fv(u.cell,tile.offset);this.instances.drawArraysInstancedANGLE(gl.TRIANGLES,0,6,n/9);}
        this.stats={cells:camera.tiles.length,marks:n/9,instances:camera.tiles.length*n/9,cpuMs:performance.now()-started};
        if (this.auditCapture) { this.auditCapture(this.canvas); this.auditCapture = null; }
    },
    hide(){if(this.canvas)this.canvas.style.display='none';if(matrixCanvas)matrixCanvas.style.visibility='visible';}
};
