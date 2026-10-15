// Canvas5 image-character adaptation; see assets/Canvas5-NOTICE.md.
// Presentation only: never rewrites Omni's immutable trail marks or audio state.
(function(root){
    'use strict';
    const MODES=['original','shading','braille','lines'];
    const FLAT=[0,4,36,37,165,167,183,247,255];
    const BITS=[1,8,2,16,4,32,64,128]; // Row-major source samples.
    const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
    const state=root.RainMediaCharacters={mode:'shading',density:50,image:null,revision:0,error:'',stats:{}};
    try{const saved=JSON.parse(localStorage.getItem('matrixRain.mediaCharacters')||'null');if(MODES.includes(saved?.mode))state.mode=saved.mode;if(Number.isFinite(saved?.density))state.density=clamp(saved.density,0,100);}catch{}
    function brailleMask(values,amount=50){
        const min=Math.min(...values),max=Math.max(...values),a=clamp(amount/100,0,1);
        if(max<=4/255)return 0;
        if(max-min<=12/255)return FLAT[Math.round(a*8)];
        const threshold=max+.5/255-a*(max-min+1/255);
        return values.reduce((mask,value,i)=>mask+(value>threshold?BITS[i]:0),0);
    }
    state.brailleMask=brailleMask;
    state.shadeIndex=(luma,count)=>Math.min(count-1,Math.max(0,Math.floor(luma*(count-1))));
    state.edgeBucket=function(values,threshold=28/255){
        const [tl,tc,tr,ml,,mr,bl,bc,br]=values;
        const gx=tr+2*mr+br-tl-2*ml-bl,gy=bl+2*bc+br-tl-2*tc-tr;
        if(Math.abs(gx)+Math.abs(gy)<threshold)return -1;
        let angle=Math.atan2(gy,gx)+Math.PI/2;if(angle<0)angle+=Math.PI;
        return Math.floor(angle/Math.PI*4+.5)&3;
    };
    state.samplingSize=function(aspect,quality){
        if(this.mode==='original')return [Math.max(1,Math.round(Math.min(384,480*aspect))),Math.max(1,Math.round(Math.min(384,480*aspect)/aspect))];
        const cap=quality==='low'?384:quality==='sharp'?1024:768;
        const width=Math.max(1,Math.round(Math.min(cap,960*aspect,Math.sqrt(450000*aspect))));
        return [width,Math.max(1,Math.round(width/aspect))];
    };
    // Identical function in vertex/fragment variants; no vertex texture support assumed.
    // WebGL1 uses arithmetic masks. Image shape and RGB share the current media texture.
    state.selectionGLSL=`
        float chooseMediaPattern(vec4 rect){
            if(mediaCharacters==1||mediaCharacters==3){
                vec4 p=texture2D(mediaImage,rect.xy+rect.zw*.5);
                if(mediaCharacters==3){
                    vec2 center=rect.xy+rect.zw*.5;
                    ${['tl','tc','tr','ml','mc','mr','bl','bc','br'].map((name,i)=>`float ${name}=dot(texture2D(mediaImage,center+rect.zw*vec2(${(i%3-1).toFixed(1)},${(Math.floor(i/3)-1).toFixed(1)})).rgb,vec3(.2126,.7152,.0722));`).join('\n')}
                    float gx=tr+2.*mr+br-tl-2.*ml-bl,gy=bl+2.*bc+br-tl-2.*tc-tr;
                    if(abs(gx)+abs(gy)>=28./255.){
                        float angle=atan(gy,gx)+1.57079632679;if(angle<0.)angle+=3.14159265359;
                        float bucket=mod(floor(angle/3.14159265359*4.+.5),4.);
                        ${['_','\\','|','/'].map((char,i)=>`if(bucket<${(i+1).toFixed(1)})return ${(256+(root.RainMediaGlyphAtlas?.shades.findIndex(g=>g.char===char)??0)).toFixed(1)};`).join('\n')}
                    }
                }
                return 256.+floor(clamp(dot(p.rgb,vec3(.2126,.7152,.0722)),0.,1.)*(mediaShadeCount-1.));
            }
            ${BITS.map((_,i)=>`float p${i}=dot(texture2D(mediaImage,rect.xy+rect.zw*vec2(${((i%2+.5)/2).toFixed(3)},${((Math.floor(i/2)+.5)/4).toFixed(3)})).rgb,vec3(.2126,.7152,.0722));`).join('\n')}
            float lo=min(min(min(p0,p1),min(p2,p3)),min(min(p4,p5),min(p6,p7)));
            float hi=max(max(max(p0,p1),max(p2,p3)),max(max(p4,p5),max(p6,p7)));
            if(hi<=4./255.)return 0.;
            float amount=clamp(mediaDotAmount,0.,1.);
            if(hi-lo<=12./255.){
                float rank=floor(amount*8.+.5);
                ${FLAT.slice(0,-1).map((mask,i)=>`if(rank<${(i+1).toFixed(1)})return ${mask.toFixed(1)};`).join('\n')}
                return 255.;
            }
            float threshold=hi+.5/255.-amount*(hi-lo+1./255.);
            return ${BITS.map((bit,i)=>`(p${i}>threshold?${bit.toFixed(1)}:0.)`).join('+')};
        }`;
    state.number=()=>MODES.indexOf(state.mode);
    state.setMode=function(mode){if(!MODES.includes(mode))return;this.mode=mode;save();this.refresh?.();};
    state.setDensity=function(value){this.density=clamp(Number(value)||0,0,100);save();this.refresh?.();};
    function save(){try{localStorage.setItem('matrixRain.mediaCharacters',JSON.stringify({mode:state.mode,density:state.density}));}catch{}}
    state.mount=function(parent){
        const panel=document.createElement('div');panel.id='media-character-controls';
        panel.innerHTML='<strong>Picture characters</strong><div class="settings-row" role="group" aria-label="Picture characters">'+MODES.map(mode=>`<button type="button" data-media-characters="${mode}">${mode==='original'?'Original characters':mode==='shading'?'Shading':mode==='lines'?'Lines':'Custom Braille'}</button>`).join('')+'</div><label id="media-dot-label" for="media-dot-density">Dot density<output id="media-dot-value" class="settings-value"></output><input id="media-dot-density" type="range" min="0" max="100" step="1"></label><p id="media-character-status" class="settings-hint" role="status"></p><p class="settings-hint">Current image shapes on moving trails. These choices are remembered and included in shared configurations.</p>';
        parent.append(panel);
        for(const button of panel.querySelectorAll('[data-media-characters]'))button.onclick=()=>this.setMode(button.dataset.mediaCharacters);
        panel.querySelector('input').oninput=event=>this.setDensity(event.target.value);
        this.refresh=()=>{
            const flat=typeof rainCamera!=='undefined'&&!rainCamera.enabled;
            for(const button of panel.querySelectorAll('button')){button.setAttribute('aria-pressed',String(button.dataset.mediaCharacters===this.mode));button.disabled=flat&&button.dataset.mediaCharacters!=='original';}
            panel.querySelector('#media-dot-label').hidden=this.mode!=='braille'||flat;panel.querySelector('#media-dot-label').style.display=this.mode==='braille'&&!flat?'':'none';panel.querySelector('input').value=this.density;panel.querySelector('output').textContent=this.density+'%';
            panel.querySelector('#media-character-status').textContent=flat?'Flat view keeps the original characters. Enable 3D camera to compare picture shapes.':this.error?'Character atlas unavailable: '+this.error+'. Original characters remain available.':!this.image?'Preparing bundled picture characters…':this.mode==='original'?'Original rain characters with current media colors.':this.mode==='shading'?'Canvas5 shading · current picture brightness selects glyph density.':this.mode==='lines'?'Canvas5 Lines · contour-aligned strokes with shading between edges.':'Canvas5 Braille · eight current image samples select each dot pattern.';
        };this.refresh();
    };
    if(typeof document!=='undefined'){
        const img=new Image();img.onload=()=>{state.image=img;state.revision++;state.refresh?.();};
        img.onerror=()=>{state.error='bundled image could not load';state.refresh?.();};img.src='assets/media-characters.png';
    }
})(typeof window==='undefined'?globalThis:window);
