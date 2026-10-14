// Current source RGB colors the actual moving Omni glyphs, without an overlay.
// Only a live camera uses person isolation. Local media depicts the full frame.
(function(){
    'use strict';
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
    let worker=null,ready=false,busy=false,epoch=0,lastDepth=-Infinity,depth=null,dw=0,dh=0,maskFrame=null,pendingFrame=null,depthTime=-Infinity;
    
    let source=null,error='',flow=[0,8,0],lastFrame=null,lastDetail=-Infinity;
    const stats={depthFrames:0,depthMs:0,targets:0,borrowed:0,resident:0,assigned:0,nearThreshold:0};
    function report(){
        const el=document.getElementById('media-assembly-status');if(!el)return;
        el.textContent=error?'Assembly unavailable: '+error:!source?'Source colors follow the original moving rain.':
            !isolating()?'Full-frame media colors on the original moving rain.':
            !ready?'Preparing local person isolation…':!depth?'Finding the person…':
            'Camera detail on the original moving rain, using its colors and audio palette.';
        Object.assign(el.dataset,{depthFrames:String(stats.depthFrames),depthMs:stats.depthMs.toFixed(1),borrowed:String(stats.borrowed),resident:String(stats.resident),targets:String(stats.targets),nearThreshold:String(stats.nearThreshold)});
    }
    function reset(){
        epoch++;const previous=worker;worker=null;ready=busy=false;depth=null;source=null;lastFrame=maskFrame=pendingFrame=null;depthTime=-Infinity;
        if(previous){const deadline=setTimeout(()=>previous.terminate(),3000);previous.onmessage=({data})=>{if(data.type==='disposed'){clearTimeout(deadline);previous.terminate();}};previous.postMessage({type:'dispose'});}
        lastDepth=lastDetail=-Infinity;error='';report();
    }
    function start(){
        if(worker||error)return;
        const current=epoch;
        worker=new Worker('rain-media-person-worker.js?v=085ce90fc311');
        worker.onmessage=({data})=>{
            if(current!==epoch)return;
            if(data.type==='ready'){ready=true;report();return;}
            if(data.type==='error'){error=data.message;busy=false;report();return;}
            if(data.type!=='depth'||data.epoch!==epoch)return;
            busy=false;
            const incoming=new Uint8Array(data.depth);
            depth=incoming;maskFrame=pendingFrame;depthTime=performance.now();dw=data.width;dh=data.height;stats.depthFrames=data.frames;stats.depthMs=data.ms;
            rebuildTargets();report();
        };
        worker.onerror=event=>{error=event.message||'Local person isolation failed.';busy=false;report();};
        worker.postMessage({type:'init'});report();
    }
    function isolating(){return lastFrame?.kind==='camera'&&window.rainMedia?.options.isolate!==false;}
    function sample(frame){
        if(!frame)return;
        source=frame.source;lastFrame=frame;
        if(!isolating()){
            if(!depth||dw!==frame.width||dh!==frame.height)depth=new Uint8Array(frame.width*frame.height).fill(255);
            dw=frame.width;dh=frame.height;ready=true;rebuildTargets();return;
        }
        start();
        const now=performance.now();
        // Pair a subject mask with the exact source frame it segmented. Mixing
        // an old mask with new RGB leaves the person's edges behind them.
        if(!ready||busy||now-lastDepth<65||document.hidden||window.rainSessionControls?.stopped)return;
        busy=true;lastDepth=now;pendingFrame=frame;const rgba=frame.pixels.slice().buffer;
        worker.postMessage({type:'frame',epoch,width:frame.width,height:frame.height,time:now,rgba},[rgba]);
    }
    const imageCanvas=document.createElement('canvas');
    const imageCtx=imageCanvas.getContext('2d');
    let imageRevision=0,imageWeights=null,imageColors=null;
    function rebuildTargets(){
        if(!depth||!lastFrame)return;
        const frame=isolating()?maskFrame:lastFrame;if(!frame)return;const w=frame.width,h=frame.height;
        if(imageCanvas.width!==w||imageCanvas.height!==h){imageCanvas.width=w;imageCanvas.height=h;}
        const image=imageCtx.createImageData(w,h),media=window.rainMedia;imageWeights=new Float32Array(w*h);
        const exposure=(media?.options.exposure||100)/100,contrast=(media?.options.contrast||100)/100;
        const gamma=100/(media?.options.gamma||100);
        let visible=0;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
            const i=y*w+x,p=i*4,di=Math.min(dh-1,Math.floor(y*dh/h))*dw+Math.min(dw-1,Math.floor(x*dw/w));
            const gate=(isolating()?smooth(48,160,depth[di]):1)*frame.pixels[p+3]/255;
            if(frame.kind==='camera'){
                const luma=(frame.pixels[p]*.2126+frame.pixels[p+1]*.7152+frame.pixels[p+2]*.0722)/255;
                const tone=clamp((luma-.5)*contrast+.5+(exposure-1)*.22,0,1);
                imageWeights[i]=tone*gate;image.data[p]=image.data[p+3]=Math.round(imageWeights[i]*255);
            }else{
                for(let channel=0;channel<3;channel++)image.data[p+channel]=Math.round(Math.pow(clamp((frame.pixels[p+channel]/255-.5)*contrast+.5+(exposure-1)*.22,0,1),gamma)*255);
                const tone=(image.data[p]*.2126+image.data[p+1]*.7152+image.data[p+2]*.0722)/255;
                imageWeights[i]=tone*gate;image.data[p+3]=Math.round(gate*255);
            }
            if(gate>.5)visible++;
        }
        imageCtx.putImageData(image,0,0);imageColors=image.data;imageRevision++;
        stats.targets=visible;stats.borrowed=stats.resident=0;report();
    }
    // No additional glyphs, target positions, borrowed streams or pinned image.
    // The renderer samples this light field on its existing moving rain only.
    function prepare(){return null;}
    function observe(mark){if(Math.hypot(...mark.delta)>.01)flow=mark.delta.slice();}
    // Hold a completed matching frame through normal inference scheduling.
    // Drop only a genuinely stalled result, not a briefly late camera frame.
    function current(){return !!(depth&&source&&(!isolating()||performance.now()-depthTime<=2000));}
    function indexAt(x,y){const w=imageCanvas.width,h=imageCanvas.height,px=Math.floor(x/matrixCanvas.width*w),py=Math.floor(y/matrixCanvas.height*h);return current()&&px>=0&&px<w&&py>=0&&py<h?py*w+px:-1;}
    window.rainMediaAssembly={sample,prepare,observe,reset,stats,
        strengthAt(x,y){const i=indexAt(x,y);return i<0||!imageWeights?0:imageWeights[i];},
        colorAt(x,y){const i=indexAt(x,y)*4;return i<0||!imageColors?null:{r:imageColors[i],g:imageColors[i+1],b:imageColors[i+2],coverage:imageColors[i+3]/255};},
        get ready(){return ready;},get depth(){return depth;},get frame(){return current()?{canvas:imageCanvas,revision:imageRevision,camera:lastFrame?.kind==='camera'}:null;}};
})();
