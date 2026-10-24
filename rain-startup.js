// Prepare both renderers before revealing the live scene. No heads are adopted
// and no scene/camera controls are changed during this preparation.
(function(){
    'use strict';
    const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
    window.addEventListener('DOMContentLoaded',async()=>{
        const overlay=document.getElementById('rain-startup'),status=document.getElementById('rain-startup-status');
        const progress=document.getElementById('rain-startup-progress'),fallback=document.getElementById('rain-startup-continue');
        if(!overlay)return;
        const started=performance.now();let dismissed=false;
        const report=(text,value)=>{status.textContent=text;progress.value=value;};
        const reveal=()=>{
            dismissed=true;document.documentElement.dataset.rainStartup='ready';overlay.hidden=true;
            document.documentElement.dataset.preparationMs=String(Math.round(performance.now()-started));
        };
        fallback.onclick=()=>{if(window.rainCloud)window.rainCloud.prepareRequested=false;reveal();};
        try{
            // Allow the loading UI to paint before touching graphics resources.
            await frame();await frame();
            report('Preparing rain…',.1);
            while(!MatrixRainEngine.rainConfig||!matrixCanvas?.width||!rainCamera.frame){
                if(performance.now()-started>15000)throw Error('Rain initialization took too long.');
                await frame();
            }
            await document.fonts.ready;
            rainCamera.ensureVolume();
            if(!rainCameraGPU.init())throw Error('The 3D renderer could not start.');
            report('Preparing cloud shaders…',.2);await frame();
            window.rainCloud.prepare();
            while(!window.rainCloud.engine?.ready){
                if(window.rainCloud.error)throw Error(window.rainCloud.error);
                if(performance.now()-started>45000)throw Error('Cloud preparation took too long.');
                const engine=window.rainCloud.engine;
                if(engine?.programQueue.length)report('Preparing cloud shaders…',.2+.35*(1-engine.programQueue.length/11));
                else if(engine)report('Warming cloud motion…',.55+.3*Math.min(1,engine.volume.stepCount/36));
                await frame();
            }
            report('Preparing the first frame…',.9);await frame();
            // Run the first surface readback now; it otherwise stalls the
            // user's first click even though the simulation is already warm.
            window.rainCloud.engine.extract(rainCamera.volume);
            await frame();
            rainCamera.prepareView();rainCameraGPU.render(rainCamera,1);
            await frame();await frame();
            report('Ready',1);reveal();
        }catch(error){
            console.warn('Omni preparation:',error);
            if(!dismissed){status.textContent='Cloud preparation is unavailable. You can continue with rain.';fallback.hidden=false;}
        }
    });
})();
