// Local media colors the existing moving rain. No video overlay or recording.
(function () {
    'use strict';
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const sampler=document.createElement('canvas');
    const ctx=sampler.getContext('2d',{willReadFrequently:true});
    const video=document.createElement('video');
    video.muted=true;video.playsInline=true;video.preload='auto';
    let source=null,stream=null,url=null,epoch=0,paused=false,videoPaused=false,pixels=null,toneKey='',audioGraph=null;
    let tabGraph=null,tabFrames=null,tabSpeech=null,loadedFile=null,playbackRevision=0;
    let lastSample=-Infinity,lastVideoTime=-1,revision=0,kind='',status='Load an image/video or share a tab to depict it in the moving rain.';
    const defaults={influence:100,contrast:100,exposure:100,gamma:100};
    const options={...defaults};
    try{
        const saved=JSON.parse(localStorage.getItem('matrixRain.mediaAppearance')||'null');
        for(const [key,min,max]of [['influence',0,100],['contrast',50,200],['exposure',50,200],['gamma',50,300]]){
            if(typeof saved?.[key]==='number'&&Number.isFinite(saved[key]))options[key]=Math.round(clamp(saved[key],min,max));
        }
    }catch{}
    function saveAppearance(){try{localStorage.setItem('matrixRain.mediaAppearance',JSON.stringify(options));}catch{}}
    try{localStorage.removeItem('matrixRain.cameraChoice');}catch{}
    const stats={sampleFrames:0,sampleMs:0,sourceRevision:0};
    const active=()=>!!(source&&pixels&&options.influence>0);
    const say=text=>{status=text;refresh();};
    function clearHistory(){}
    function release(){
        hideFlat();window.rainMediaWords?.stop(undefined,false);loadedFile=null;releaseSpeech();tabGraph?.dispose();tabGraph=null;tabFrames=null;
        if(kind==='video'||kind==='tab')window.rainMediaAudioEnded?.();
        window.rainMediaAssembly?.reset();
        epoch++;for(const track of stream?.getTracks()||[])track.stop();stream=null;
        video.pause();video.srcObject=null;video.removeAttribute('src');video.load();
        if(url)URL.revokeObjectURL(url);url=null;source=null;pixels=null;toneKey='';kind='';
        audioGraph?.context.suspend().catch(()=>{});
        lastVideoTime=-1;lastSample=-Infinity;paused=videoPaused=false;clearHistory();
    }
    async function loadFile(file){
        if(!file)return;const restoreAudio=!!window.audioReactiveActive;release();loadedFile=file;const audioTicket=window.rainMediaAudioToken?.();const ticket=epoch;url=URL.createObjectURL(file);say('Opening local media…');
        try{
            if(file.type.startsWith('image/')){
                const image=new Image();image.src=url;await image.decode();if(ticket!==epoch)return;
                source=image;kind='image';
            }else{
                video.src=url;video.loop=true;video.muted=false;if(audioGraph?.monitor){audioGraph.muted=false;audioGraph.monitor.gain.value=1;}source=video;kind='video';
                try{await playVideo();}catch(error){
                    if(error.name!=='NotAllowedError')throw error;
                    videoPaused=true;say('Video ready. Click Play video to start with sound.');
                }
                if(ticket!==epoch)return;
            }
            if(window.rainSessionControls?.stopped||document.hidden)pause();
            if(!videoPaused)say(kind==='video'?'Video playing with sound. Start audio response to make the rain dance to this video.':'Image loaded. Its colors follow the moving rain.');
            if(kind==='video'){window.rainUseMediaAudio?.(restoreAudio,audioTicket);window.rainMediaWords?.sourceReady();}
            else window.rainRefreshAudioControls?.();
        }catch(error){if(ticket===epoch){release();say('Could not open this media file: '+error.message);}}
    }
    async function playVideo(){
        if(audioGraph&&audioGraph.context.state!=='closed')await audioGraph.context.resume();
        const ticket=epoch,playbackTicket=playbackRevision;
        if(paused||document.hidden||window.rainSessionControls?.stopped)return;
        try{await video.play();}
        catch(error){
            if(error.name==='AbortError'&&(ticket!==epoch||playbackTicket!==playbackRevision||paused||document.hidden||window.rainSessionControls?.stopped))return;
            throw error;
        }
        if(ticket!==epoch)return;videoPaused=false;window.rainMediaWords?.resume();refresh();
    }
    async function togglePlayback(){
        if(kind!=='video'||paused)return;
        if(!video.paused){videoPaused=true;video.pause();window.rainMediaWords?.pause();say('Video paused. Click Play video to continue.');}
        else try{await playVideo();say('Video playing'+(video.muted?' (muted).':' with sound.'));}catch(error){say('Video could not play: '+error.message);}
    }
    function soundMuted(){return audioGraph?.monitor&&kind==='video'?audioGraph.muted:video.muted;}
    function toggleSound(){if(kind==='video'){if(audioGraph?.monitor){audioGraph.muted=!audioGraph.muted;audioGraph.monitor.gain.value=audioGraph.muted?0:1;}else video.muted=!video.muted;refresh();}}
    async function connectAudio(){
        if(kind==='tab'){const graph=tabGraph,ticket=epoch;if(!graph)throw Error('This share has no audio. Share a tab with audio enabled.');await graph.context.resume();if(ticket!==epoch)throw Error('The shared source changed.');return graph;}
        if(kind!=='video')throw Error('Load a video before using its audio.');
        const ticket=epoch;
        if(!audioGraph){
            const context=new (window.AudioContext||window.webkitAudioContext)();
            const input=context.createMediaElementSource(video),analyser=context.createAnalyser();
            analyser.fftSize=2048;analyser.smoothingTimeConstant=.2;
            // One persistent source per element: stopping analysis must not
            // close the graph or silence later video playback.
            input.connect(context.destination);input.connect(analyser);audioGraph={context,analyser,input};
        }
        await audioGraph.context.resume();
        if(ticket!==epoch||kind!=='video')throw Error('Video changed before audio could start.');
        return audioGraph;
    }
    function releaseSpeech(){
        for(const track of tabSpeech?.getTracks()||[])track.stop();tabSpeech=null;
        if(audioGraph?.speech){audioGraph.input.disconnect(audioGraph.speech);audioGraph.speech.stream.getTracks().forEach(t=>t.stop());audioGraph.speech=null;}
    }
    async function connectSpeech(){
        if(kind==='tab'){
            const track=stream?.getAudioTracks().find(t=>t.readyState==='live');
            if(!track)throw Error('The shared tab has no live audio. Share a tab with audio enabled.');
            if(!tabSpeech?.getAudioTracks().some(t=>t.readyState==='live')){releaseSpeech();tabSpeech=new MediaStream([track.clone()]);}
            return tabSpeech;
        }
        const graph=await connectAudio();
        if(!graph.speech){
            graph.speech=graph.context.createMediaStreamDestination();graph.input.connect(graph.speech);
            if(!graph.monitor){graph.monitor=graph.context.createGain();graph.muted=video.muted;graph.monitor.gain.value=video.muted?0:1;
                graph.input.disconnect(graph.context.destination);graph.input.connect(graph.monitor);graph.monitor.connect(graph.context.destination);video.muted=false;}
        }
        return graph.speech.stream;
    }
    function setWordSync(active){
        tabGraph?.mode(active,window.rainMediaWords?.options.bufferMs??1900);
        const output=document.getElementById('media-status');
        if(output&&kind==='tab')output.textContent=tabGraph?.active?'Shared tab · picture and sound delayed together for local words.':tabGraph?.suppressed?'Shared tab · live picture and sound.':'Shared tab · sound plays in the original tab. Synchronized delay is unavailable for this share.';
    }
    async function startTab(){
        if(kind==='opening-tab')return;
        const restoreAudio=!!window.audioReactiveActive;release();const ticket=epoch,audioTicket=window.rainMediaAudioToken?.();kind='opening-tab';say('Choose a browser tab and enable Share tab audio. Return to Omni after sharing to see its picture in the rain.');
        let incoming;
        try{
            incoming=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:30}},audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,suppressLocalAudioPlayback:true}});
            if(ticket!==epoch){incoming.getTracks().forEach(t=>t.stop());return;}
            stream=incoming;source=video;kind='tab';video.srcObject=stream;video.muted=true;video.loop=false;
            tabFrames=new window.RainTabSync.FrameDelay();
            // Selecting the source tab may hide Omni while playback starts.
            // A visibility pause is not a failed capture: keep its live tracks.
            if(document.hidden||window.rainSessionControls?.stopped)pause();
            else await playVideo();
            if(ticket!==epoch)return;
            for(const track of stream.getVideoTracks())track.addEventListener('ended',()=>{if(stream===incoming){release();say('Tab sharing ended. Normal rain continues.');}},{once:true});
            let audioError='';
            try{tabGraph=window.RainTabSync.create(stream);if(tabGraph)await tabGraph.context.resume();}
            catch(error){tabGraph?.dispose();tabGraph=null;audioError=' Audio analysis could not start: '+error.message;}
            if(ticket!==epoch)return;
            for(const track of stream.getAudioTracks())track.addEventListener('ended',()=>{if(stream!==incoming)return;window.rainMediaWords?.stop('Shared audio ended. The shared picture continues.');tabGraph?.dispose();tabGraph=null;window.rainMediaAudioEnded?.();window.rainRefreshAudioControls?.();say('Shared picture continues. Share again with tab audio for lyrics.');},{once:true});
            say((incoming.getAudioTracks().some(t=>t.readyState==='live')?'Shared tab connected. Audio response uses its sound. Words are optional.':'Picture connected without audio. Share a tab with audio to use lyrics.')+audioError);
            if(document.hidden||window.rainSessionControls?.stopped)pause();
            window.rainUseMediaAudio?.(restoreAudio,audioTicket);window.rainRefreshAudioControls?.();window.rainMediaWords?.sourceReady();
        }catch(error){if(incoming&&incoming!==stream)incoming.getTracks().forEach(t=>t.stop());if(ticket===epoch){release();say('Could not share this source: '+error.message);}}
    }
    function present(now){
        if(!source||paused||options.influence===0||now-lastSample<1000/24)return;
        const key=options.exposure+':'+options.contrast+':'+options.gamma;
        
        const isVideo=source===video;
        if(isVideo&&(video.readyState<2||(video.currentTime===lastVideoTime&&key===toneKey)))return;
        // Static images are read once. Canvas inputs also permit deterministic
        // browser verification without opening a capture picker.
        if(kind==='image'&&pixels&&key===toneKey&&sampler.dataset.aspect===String(innerWidth/innerHeight))return;
        const sw=source.videoWidth||source.naturalWidth||source.width;
        const sh=source.videoHeight||source.naturalHeight||source.height;
        if(!sw||!sh)return;
        const aspect=innerWidth/innerHeight;
        const width=Math.max(1,Math.round(Math.min(384,480*aspect))),height=Math.max(1,Math.round(width/aspect));
        const started=performance.now();
        try{
            if(sampler.width!==width||sampler.height!==height){sampler.width=width;sampler.height=height;}
            ctx.clearRect(0,0,width,height);
            ctx.save();
            // Video fills the complete viewport, keeping its encoded content.
            // Still images retain their proportions with a crop.
            if(kind==='video'||kind==='tab')ctx.drawImage(source,0,0,sw,sh,0,0,width,height);
            else{
                const factor=Math.max(width/sw,height/sh),cw=width/factor,ch=height/factor;
                ctx.drawImage(source,(sw-cw)/2,(sh-ch)/2,cw,ch,0,0,width,height);
            }
            ctx.restore();
            pixels=ctx.getImageData(0,0,width,height).data;
            sampler.dataset.aspect=String(aspect);
            lastSample=now;lastVideoTime=isVideo?video.currentTime:-1;toneKey=key;
            let frame={source,pixels,width,height,kind};
            if(kind==='tab'&&tabFrames)frame=tabFrames.sample(frame,now,window.rainMediaWords?.options.bufferMs??1900,!!tabGraph?.active);
            window.rainMediaAssembly?.sample(frame);
            stats.sampleFrames++;stats.sampleMs=performance.now()-started;stats.sourceRevision=revision;
            const output=document.getElementById('media-status');
            if(output){output.dataset.frames=String(stats.sampleFrames);output.dataset.sourceSize=sw+'×'+sh;output.dataset.ready=String(active());}
        }catch(error){release();say('This media could not be sampled: '+error.message);}
    }
    function strengthAt(x,y){return window.rainMediaAssembly?.strengthAt(x,y)||0;}
    function colorAt(x,y){return window.rainMediaAssembly?.colorAt(x,y)||null;}
    let flatOutput=null,flatTint=null,flatContext=null,tintContext=null,flatVisible=false;
    function hideFlat(){if(flatOutput)flatOutput.style.display='none';if(flatVisible)matrixCanvas.style.visibility='visible';flatVisible=false;}
    function presentFlat(enabled){
        const frame=active()?window.rainMediaAssembly?.frame:null;
        if(!enabled||!frame||paused||window.rainSessionControls?.stopped){hideFlat();return;}
        if(!flatOutput){
            flatOutput=document.createElement('canvas');flatOutput.id='media-flat-rain';
            flatOutput.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;background:#000';
            flatContext=flatOutput.getContext('2d');flatTint=document.createElement('canvas');tintContext=flatTint.getContext('2d');document.body.appendChild(flatOutput);
        }
        const w=matrixCanvas.width,h=matrixCanvas.height;
        if(flatOutput.width!==w||flatOutput.height!==h){flatOutput.width=flatTint.width=w;flatOutput.height=flatTint.height=h;}
        // Color the current rain's exact glyph alpha. A separate presentation
        // copy keeps old media pixels out of the rain history.
        tintContext.globalCompositeOperation='source-over';tintContext.clearRect(0,0,w,h);tintContext.drawImage(matrixCanvas,0,0);
        tintContext.globalCompositeOperation='source-in';tintContext.drawImage(frame.canvas,0,0,w,h);
        flatContext.globalCompositeOperation='source-over';flatContext.globalAlpha=1;flatContext.clearRect(0,0,w,h);flatContext.drawImage(matrixCanvas,0,0);
        flatContext.globalAlpha=options.influence/100;
        flatContext.globalCompositeOperation='destination-out';flatContext.drawImage(frame.canvas,0,0,w,h);flatContext.globalCompositeOperation='lighter';
        flatContext.drawImage(flatTint,0,0);
        flatContext.globalAlpha=1;flatContext.globalCompositeOperation='source-over';flatOutput.style.opacity=matrixCanvas.style.opacity||'.8';flatOutput.style.display='block';matrixCanvas.style.visibility='hidden';flatVisible=true;
    }
    function pause(){
        playbackRevision++;paused=true;window.rainMediaWords?.pause();hideFlat();video.pause();tabGraph?.context.suspend().catch(()=>{});audioGraph?.context.suspend().catch(()=>{});for(const track of stream?.getVideoTracks()||[])track.enabled=false;refresh();
    }
    function resume(){
        paused=false;lastSample=-Infinity;tabGraph?.context.resume().catch(()=>{});for(const track of stream?.getVideoTracks()||[])track.enabled=true;
        if(source===video&&!videoPaused)playVideo().catch(()=>say('Media paused. Click Play video to continue.'));refresh();
    }
    function stop(){release();say('Media depiction stopped. Normal rain continues.');}
    function reset(){stop();window.rainMediaWords?.resetOptIn();Object.assign(options,defaults);saveAppearance();refresh();}
    function refresh(){
        if(!document.getElementById('media-file'))return;
        document.getElementById('media-stop').disabled=!source&&kind!=='opening-tab';
        const share=document.getElementById('media-tab');share.disabled=kind==='opening-tab'||!navigator.mediaDevices?.getDisplayMedia;share.textContent=kind==='opening-tab'?'Choose tab…':'Share tab / screen';
        const playback=document.getElementById('media-video-controls');playback.hidden=kind!=='video';
        document.getElementById('media-play').textContent=video.paused?'Play video':'Pause video';
        document.getElementById('media-play').disabled=paused;
        document.getElementById('media-sound').textContent=soundMuted()?'Unmute video':'Mute video';
        document.getElementById('media-sound').setAttribute('aria-pressed',String(soundMuted()));
        document.getElementById('media-status').textContent=paused&&source?'Depiction paused. Resume in the header to continue.':status;
        for(const key of ['influence','contrast','exposure','gamma']){
            document.getElementById('media-'+key).value=options[key];document.getElementById('media-'+key+'-value').textContent=options[key]+'%';
        }window.rainMediaWords?.refresh();
    }
    function mount(content,before){
        const panel=document.createElement('details');panel.id='settings-media';panel.className='settings-category';
        panel.innerHTML=`<summary>Media depiction<span class="category-note">Video · image · tab</span></summary>
            <div class="category-body">
            <div class="settings-row"><button id="media-file" type="button">Load image / video</button><button id="media-tab" type="button">Share tab / screen</button><button id="media-stop" type="button">Stop depiction</button></div>
            <p class="settings-hint">For a live video, choose <strong>Share tab / screen</strong>, select its browser tab with tab audio enabled, then return here. Keep the original video playing; its picture is rendered in this rain view.</p>
            <input id="media-file-input" type="file" accept="image/*,video/*" hidden>
            <div id="media-video-controls" hidden><div class="settings-row"><button id="media-play" type="button">Pause video</button><button id="media-sound" type="button" aria-pressed="false">Mute video</button></div><p class="settings-hint">Video plays locally with sound. Audio response uses this video's sound without screen sharing. Nothing is uploaded.</p></div>
            <p id="media-status" class="settings-hint" role="status"></p>
            <p id="media-assembly-status" class="settings-hint" role="status">Media colors follow the original moving rain.</p>
            <p class="settings-hint">Full-frame media · original rain motion</p>
            
            <label for="media-influence">Image influence<output id="media-influence-value" class="settings-value"></output><input id="media-influence" type="range" min="0" max="100" step="1"></label>
            <label for="media-exposure">Image exposure<output id="media-exposure-value" class="settings-value"></output><input id="media-exposure" type="range" min="50" max="200" step="1"></label>
            <label for="media-contrast">Image contrast<output id="media-contrast-value" class="settings-value"></output><input id="media-contrast" type="range" min="50" max="200" step="1"></label>
            <label for="media-gamma">Image gamma · brighten shadows<output id="media-gamma-value" class="settings-value"></output><input id="media-gamma" type="range" min="50" max="300" step="1"></label>
            <p class="settings-hint">Images, videos and shared tabs supply their own colors and use the full frame. Omni motion, audio response and trails continue normally. Nothing is recorded or uploaded.</p>
            </div>`;
        content.insertBefore(panel,before);
        // Keep the source inspectable without drawing it over the rain.
        video.id='media-source-video';video.hidden=true;panel.appendChild(video);
        document.getElementById('media-stop').onclick=stop;
        document.getElementById('media-tab').onclick=startTab;
        document.getElementById('media-tab').disabled=!navigator.mediaDevices?.getDisplayMedia;
        window.rainMediaWords?.mount(panel.querySelector('.category-body'));
        document.getElementById('media-play').onclick=togglePlayback;
        document.getElementById('media-sound').onclick=toggleSound;
        const input=document.getElementById('media-file-input');
        document.getElementById('media-file').onclick=()=>input.click();
        input.onchange=()=>{loadFile(input.files[0]);input.value='';};
        for(const key of ['influence','contrast','exposure','gamma'])document.getElementById('media-'+key).oninput=event=>{
            options[key]=Number(event.target.value);saveAppearance();refresh();
        };
        refresh();
    }
    window.addEventListener('pagehide',release);
    document.addEventListener('visibilitychange',()=>{
        if(document.hidden)pause();else if(!window.rainSessionControls?.stopped)resume();
    });
    window.rainMedia={mount,present,presentFlat,strengthAt,colorAt,loadFile,stop,pause,resume,reset,connectAudio,connectSpeech,setWordSync,startTab,releaseSpeech,options,stats,refresh,saveAppearance,
        get active(){return active();},get stream(){return stream;},get source(){return source;},get status(){return status;},
        get file(){return kind==='video'?loadedFile:null;},get hasVideo(){return kind==='video';},get hasAudioSource(){return kind==='video'||(kind==='tab'&&!!stream?.getAudioTracks().some(t=>t.readyState==='live'));},get audioLabel(){return kind==='tab'?'shared tab':'loaded video';},get playbackPaused(){return paused||videoPaused||video.paused;},get audioContext(){return (kind==='tab'?tabGraph:audioGraph)?.context||null;},
        get frame(){return window.rainMediaAssembly?.frame||null;},
        // A canvas may also supply frames; used by deterministic visual tests.
        useCanvas(canvas){release();source=canvas;kind='canvas';say('Local canvas source active.');}
    };
})();
