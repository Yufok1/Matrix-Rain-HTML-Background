// Camera-guided circulation of actual Omni glyphs. No video/photo overlay.
// MediaPipe supplies a person mask; current video supplies all tonal detail.
(function(){
    'use strict';
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
    let worker=null,ready=false,busy=false,epoch=0,lastDepth=-Infinity,depth=null,dw=0,dh=0;
    
    let source=null,error='',flow=[0,8,0],lastFrame=null,lastDetail=-Infinity;
    const stats={depthFrames:0,depthMs:0,targets:0,borrowed:0,resident:0,assigned:0,nearThreshold:0};
    function report(){
        const el=document.getElementById('media-assembly-status');if(!el)return;
        el.textContent=error?'Assembly unavailable: '+error:!source?'The camera lights the original moving rain.':
            !ready?'Preparing local person isolation…':!depth?'Finding the person…':
            'Camera detail on original moving rain - no separate image glyphs';
        Object.assign(el.dataset,{depthFrames:String(stats.depthFrames),depthMs:stats.depthMs.toFixed(1),borrowed:String(stats.borrowed),resident:String(stats.resident),targets:String(stats.targets),nearThreshold:String(stats.nearThreshold)});
    }
    function reset(){
        epoch++;const previous=worker;worker=null;ready=busy=false;depth=null;source=null;lastFrame=null;
        if(previous){const deadline=setTimeout(()=>previous.terminate(),3000);previous.onmessage=({data})=>{if(data.type==='disposed'){clearTimeout(deadline);previous.terminate();}};previous.postMessage({type:'dispose'});}
        lastDepth=lastDetail=-Infinity;error='';report();
    }
    function start(){
        if(worker||error)return;
        const current=epoch;
        worker=new Worker('rain-media-person-worker.js?v=15fc47a9eefc');
        worker.onmessage=({data})=>{
            if(current!==epoch)return;
            if(data.type==='ready'){ready=true;report();return;}
            if(data.type==='error'){error=data.message;busy=false;report();return;}
            if(data.type!=='depth'||data.epoch!==epoch)return;
            busy=false;
            const incoming=new Uint8Array(data.depth);
            depth=incoming;dw=data.width;dh=data.height;stats.depthFrames=data.frames;stats.depthMs=data.ms;
            rebuildTargets();report();
        };
        worker.onerror=event=>{error=event.message||'Local person isolation failed.';busy=false;report();};
        worker.postMessage({type:'init'});report();
    }
    function sample(frame){
        if(!frame)return;
        source=frame.source;lastFrame=frame;
        if(frame.kind==='image'){depth=new Uint8Array(frame.width*frame.height).fill(255);dw=frame.width;dh=frame.height;ready=true;rebuildTargets();return;}
        start();
        const now=performance.now();
        // Texture detail must follow the video, not the slower depth inference.
        if(depth&&now-lastDetail>45){rebuildTargets();lastDetail=now;}
        if(!ready||busy||now-lastDepth<65||document.hidden||window.rainSessionControls?.stopped)return;
        busy=true;lastDepth=now;const rgba=frame.pixels.slice().buffer;
        worker.postMessage({type:'frame',epoch,width:frame.width,height:frame.height,time:now,rgba},[rgba]);
    }
    const imageCanvas=document.createElement('canvas');
    const imageCtx=imageCanvas.getContext('2d');
    let imageRevision=0,imageWeights=null;
    function rebuildTargets(){
        if(!depth||!lastFrame)return;
        const frame=lastFrame,w=frame.width,h=frame.height;
        if(imageCanvas.width!==w||imageCanvas.height!==h){imageCanvas.width=w;imageCanvas.height=h;}
        const image=imageCtx.createImageData(w,h),media=window.rainMedia;imageWeights=new Float32Array(w*h);
        const exposure=(media?.options.exposure||100)/100,contrast=(media?.options.contrast||100)/100;
        let visible=0;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
            const i=y*w+x,p=i*4,di=Math.min(dh-1,Math.floor(y*dh/h))*dw+Math.min(dw-1,Math.floor(x*dw/w));
            const gate=smooth(160,220,depth[di]);
            const luma=(frame.pixels[p]*.2126+frame.pixels[p+1]*.7152+frame.pixels[p+2]*.0722)/255;
            const tone=clamp((luma-.5)*contrast+.5+(exposure-1)*.22,0,1);
            imageWeights[i]=tone*gate;image.data[p]=Math.round(imageWeights[i]*255);image.data[p+3]=255;
            if(gate>.5)visible++;
        }
        imageCtx.putImageData(image,0,0);imageRevision++;
        stats.targets=visible;stats.borrowed=stats.resident=0;report();
    }
    // No additional glyphs, target positions, borrowed streams or pinned image.
    // The renderer samples this light field on its existing moving rain only.
    function prepare(){return null;}
    function observe(mark){if(Math.hypot(...mark.delta)>.01)flow=mark.delta.slice();}
    window.rainMediaAssembly={sample,prepare,observe,reset,stats,strengthAt(x,y){if(!imageWeights||!depth)return 0;const w=imageCanvas.width,h=imageCanvas.height,px=Math.floor(x/matrixCanvas.width*w),py=Math.floor(y/matrixCanvas.height*h);return px>=0&&px<w&&py>=0&&py<h?imageWeights[py*w+px]:0;},get ready(){return ready;},get depth(){return depth;},get frame(){return depth&&source?{canvas:imageCanvas,revision:imageRevision}:null;}};
})();
