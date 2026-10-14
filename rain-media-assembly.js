// Current source RGB colors the existing moving Omni glyphs, without an overlay.
(function(){
    'use strict';
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    let source=null,imageWeights=null,imageColors=null,imageRevision=0;
    const stats={targets:0};
    const imageCanvas=document.createElement('canvas');
    const imageCtx=imageCanvas.getContext('2d');
    function report(){
        const el=document.getElementById('media-assembly-status');if(!el)return;
        el.textContent=source?'Full-frame media colors on the original moving rain.':'Source colors follow the original moving rain.';
    }
    function reset(){source=null;imageWeights=imageColors=null;stats.targets=0;report();}
    function sample(frame){
        if(!frame)return;
        source=frame.source;const w=frame.width,h=frame.height;
        if(imageCanvas.width!==w||imageCanvas.height!==h){imageCanvas.width=w;imageCanvas.height=h;}
        const image=imageCtx.createImageData(w,h),media=window.rainMedia;imageWeights=new Float32Array(w*h);
        const exposure=(media?.options.exposure||100)/100,contrast=(media?.options.contrast||100)/100;
        const gamma=100/(media?.options.gamma||100);
        let visible=0;
        for(let i=0;i<w*h;i++){
            const p=i*4,gate=frame.pixels[p+3]/255;
            for(let channel=0;channel<3;channel++)image.data[p+channel]=Math.round(Math.pow(clamp((frame.pixels[p+channel]/255-.5)*contrast+.5+(exposure-1)*.22,0,1),gamma)*255);
            const tone=(image.data[p]*.2126+image.data[p+1]*.7152+image.data[p+2]*.0722)/255;
            imageWeights[i]=tone*gate;image.data[p+3]=Math.round(gate*255);
            if(gate>.5)visible++;
        }
        imageCtx.putImageData(image,0,0);imageColors=image.data;imageRevision++;stats.targets=visible;report();
    }
    function indexAt(x,y){
        const w=imageCanvas.width,h=imageCanvas.height,px=Math.floor(x/matrixCanvas.width*w),py=Math.floor(y/matrixCanvas.height*h);
        return source&&px>=0&&px<w&&py>=0&&py<h?py*w+px:-1;
    }
    window.rainMediaAssembly={sample,reset,stats,
        strengthAt(x,y){const i=indexAt(x,y);return i<0||!imageWeights?0:imageWeights[i];},
        colorAt(x,y){const i=indexAt(x,y)*4;return i<0||!imageColors?null:{r:imageColors[i],g:imageColors[i+1],b:imageColors[i+2],coverage:imageColors[i+3]/255};},
        get ready(){return !!source;},get frame(){return source?{canvas:imageCanvas,revision:imageRevision}:null;}};
})();
