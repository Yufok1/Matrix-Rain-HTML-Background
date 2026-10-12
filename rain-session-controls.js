// Stop freezes this session; Resume preserves it; Reset restores defaults.
(function(){
    let stopped=false,saved=null,operation=0;
    const refresh=()=>window.rainSettingsUI?.refresh();
    function stop(){
        if(stopped)return;
        stopped=true;operation++;
        saved={audio:audioReactiveActive,auto:autoOrchestratorActive,palette:rainAudioPalette.active,
            tracks:audioStream?audioStream.getAudioTracks().map(track=>({track,enabled:track.enabled})):[]};
        // Keep permission and stream ownership for a seamless resume, while
        // muting input and suspending all analysis, drawing and scene timers.
        audioReactiveActive=window.audioReactiveActive=false;
        if(!audioStream)rainAudioRequestVersion++;
        autoOrchestratorActive=window.autoOrchestratorActive=false;
        stopAutoOrchestrator();stopMatrixAnimation();
        if(audioAnimationFrame!==null){cancelAnimationFrame(audioAnimationFrame);audioAnimationFrame=null;}
        for(const {track} of saved.tracks)track.enabled=false;
        if(audioContext&&audioContext.state!=='closed')audioContext.suspend().catch(()=>{});
        rainAudioPalette.active=false;
        rainCameraGPU.hide();matrixCanvas.style.display='none';
        refresh();
    }
    async function resume(){
        if(!stopped)return;
        stopped=false;const version=++operation,previous=saved;saved=null;
        matrixCanvas.style.display='block';rainCamera.lastTime=null;
        if(previous?.audio){
            const sourceEnded=audioStream?!audioStream.getAudioTracks().some(track=>track.readyState==='live'):!window.wallpaperRegisterAudioListener;
            if(sourceEnded){stopAudioReactive();document.getElementById('audioStatus').textContent='Audio source ended. Start audio response to reconnect.';}
            else{
                audioReactiveActive=window.audioReactiveActive=true;
                for(const {track,enabled} of previous.tracks)if(track.readyState==='live')track.enabled=enabled;
                rainAudioPalette.active=previous.palette;
                if(audioContext&&audioContext.state!=='closed'){
                    try{await audioContext.resume();}catch(_){stopAudioReactive();audioReactiveActive=window.audioReactiveActive=false;document.getElementById('audioStatus').textContent='Audio could not resume. Start audio response to reconnect.';}
                    if(version!==operation||stopped)return;
                    if(audioReactiveActive&&audioAnalyser)analyzeAudio();
                }
            }
        }
        if(previous?.auto){autoOrchestratorActive=window.autoOrchestratorActive=true;scheduleNextChange();}
        startMatrixAnimation();updateModeButtons(audioReactiveActive?'audio':autoOrchestratorActive?'orchestrator':null);refresh();
    }
    function reset(){
        operation++;stopMatrixAnimation();
        audioReactiveActive=window.audioReactiveActive=false;
        autoOrchestratorActive=window.autoOrchestratorActive=false;
        stopAutoOrchestrator();stopAudioReactive();resetAudioMotion();
        stopped=false;saved=null;
        const secondary=document.getElementById('secondaryColor');secondary.disabled=false;secondary.style.opacity='1';secondary.style.pointerEvents='auto';secondary.style.filter='none';secondary.previousElementSibling.style.opacity='1';
        document.getElementById('audioStatus').textContent='';updateModeButtons(null);
        rainSettingsShare.apply(rainSettingsShare.defaults());
        document.getElementById('rain-share-name').value='';
        // Clear the old scene, without adding another resize listener or
        // rebuilding the renderer. Keep the old share code available to undo.
        rainCamera.marks.length=rainCamera.pending.length=0;rainCamera.streams.clear();rainCamera.bounds=null;rainCamera.frame=0;rainCamera.lastTime=null;rainCameraGPU.invalidate=true;
        rainMotion.drops.length=0;rainMotion.planar='down';rainMotion.direction='down';rainMotion.reverse=1;
        matrixDrops=Array.from({length:Math.max(1,Math.floor(matrixCanvas.width/10))},()=>Math.random()*matrixCanvas.height/MatrixRainEngine.rainConfig.fontSize-Math.random()*50);
        matrixCtx.save();matrixCtx.globalAlpha=1;matrixCtx.fillStyle='#000';matrixCtx.fillRect(0,0,matrixCanvas.width,matrixCanvas.height);matrixCtx.restore();
        matrixCanvas.style.display='block';startMatrixAnimation();refresh();
    }
    window.rainSessionControls={stop,resume,reset,get stopped(){return stopped;},get audioPaused(){return stopped&&!!saved?.audio;}};
})();
