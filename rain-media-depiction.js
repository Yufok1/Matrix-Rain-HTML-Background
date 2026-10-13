// Local experiment: existing rain births assemble an image. No video overlay,
// audio capture or new particle simulation. The source adds detail to existing ink.
(function () {
    'use strict';
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const sampler=document.createElement('canvas');
    const ctx=sampler.getContext('2d',{willReadFrequently:true});
    const video=document.createElement('video');
    video.muted=true;video.playsInline=true;video.preload='auto';
    let source=null,stream=null,url=null,epoch=0,paused=false,pixels=null,toneKey='';
    let lastSample=-Infinity,lastVideoTime=-1,revision=0,kind='',status='Camera or local media, depicted by the moving rain.';
    const defaults={mode:'assembly',influence:95,contrast:110,exposure:100,mirror:true};
    const options={...defaults};
    const stats={sampleFrames:0,sampleMs:0,sourceRevision:0};
    const active=()=>!!(source&&pixels&&options.influence>0);
    const say=text=>{status=text;refresh();};
    function clearHistory(){}
    function release(){
        window.rainMediaAssembly?.reset();
        epoch++;for(const track of stream?.getTracks()||[])track.stop();stream=null;
        video.pause();video.srcObject=null;video.removeAttribute('src');video.load();
        if(url)URL.revokeObjectURL(url);url=null;source=null;pixels=null;toneKey='';kind='';
        lastVideoTime=-1;lastSample=-Infinity;paused=false;clearHistory();
    }
    async function startCamera(deviceId){
        release();const ticket=epoch;kind='opening';say('Opening camera…');
        try{
            if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera access is unavailable in this browser.');
            // Prefer a connected Iriun source; otherwise use the device's front camera.
            if(!deviceId){const cameras=await navigator.mediaDevices.enumerateDevices();deviceId=cameras.find(camera=>camera.kind==='videoinput'&&/iriun/i.test(camera.label))?.deviceId;}
            let incoming=await navigator.mediaDevices.getUserMedia({audio:false,video:{
                width:{ideal:640},height:{ideal:480},...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:'user'})
            }});
            // Device labels can be empty until the first permission grant.
            // Resolve Iriun again after that grant instead of accepting the
            // system default (often an inactive virtual DroidCam source).
            if(!deviceId){
                const available=await navigator.mediaDevices.enumerateDevices();
                const iriun=available.find(camera=>camera.kind==='videoinput'&&/iriun/i.test(camera.label));
                const selected=incoming.getVideoTracks()[0]?.getSettings().deviceId;
                if(iriun&&selected!==iriun.deviceId){
                    incoming.getTracks().forEach(track=>track.stop());
                    if(ticket!==epoch)return;
                    incoming=await navigator.mediaDevices.getUserMedia({audio:false,video:{deviceId:{exact:iriun.deviceId},width:{ideal:640},height:{ideal:480}}});
                }
            }
            if(ticket!==epoch){incoming.getTracks().forEach(track=>track.stop());return;}
            stream=incoming;video.srcObject=stream;source=video;kind='camera';
            for(const track of incoming.getVideoTracks())track.addEventListener('ended',()=>{
                if(stream===incoming){release();say('Camera ended. Start camera to reconnect.');}
            });
            await video.play();if(ticket!==epoch)return;
            if(window.rainSessionControls?.stopped||document.hidden)pause();
            say('Camera connected. Waiting for its first image…');
        }catch(error){
            if(ticket!==epoch)return;release();
            say(error.name==='NotAllowedError'?(typeof window.wallpaperRegisterAudioListener==='function'?'Camera access is blocked by Wallpaper Engine. CEF media access must be enabled in its settings. Normal rain and desktop audio still work.':'Camera permission was denied. You can also load a local image or video.'):'Camera could not start: '+error.message);
        }
    }
    async function nextCamera(){
        if(kind!=='camera'||!stream)return;
        try{
            const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
            if(devices.length<2){say('Only one camera is available.');return;}
            const id=stream.getVideoTracks()[0]?.getSettings().deviceId;
            const next=devices[(devices.findIndex(d=>d.deviceId===id)+1)%devices.length];
            await startCamera(next.deviceId);
        }catch(error){say('Could not switch camera: '+error.message);}
    }
    async function loadFile(file){
        if(!file)return;release();const ticket=epoch;url=URL.createObjectURL(file);say('Opening local media…');
        try{
            if(file.type.startsWith('image/')){
                const image=new Image();image.src=url;await image.decode();if(ticket!==epoch)return;
                source=image;kind='image';
            }else{
                video.src=url;video.loop=true;source=video;kind='video';await video.play();if(ticket!==epoch)return;
                }
            if(window.rainSessionControls?.stopped||document.hidden)pause();
            say('Local '+kind+' loaded. Audio response keeps using your chosen audio source.');
        }catch(error){if(ticket===epoch){release();say('Could not open this media file: '+error.message);}}
    }
    function present(now){
        if(!source||paused||options.influence===0||now-lastSample<1000/24)return;
        const key=options.exposure+':'+options.contrast+':'+options.mirror;
        
        const isVideo=source===video;
        if(isVideo&&(video.readyState<2||video.currentTime===lastVideoTime))return;
        // Static images are read once. Canvas inputs also permit deterministic
        // browser verification without accessing a real camera.
        if(kind==='image'&&pixels&&key===toneKey&&sampler.dataset.aspect===String(innerWidth/innerHeight))return;
        const sw=source.videoWidth||source.naturalWidth||source.width;
        const sh=source.videoHeight||source.naturalHeight||source.height;
        if(!sw||!sh)return;
        const aspect=innerWidth/innerHeight;
        const width=Math.max(1,Math.round(Math.min(384,480*aspect))),height=Math.max(1,Math.round(width/aspect));
        const started=performance.now();
        try{
            if(sampler.width!==width||sampler.height!==height){sampler.width=width;sampler.height=height;}
            // Cover crop, matching the viewport instead of stretching faces.
            const factor=Math.max(width/sw,height/sh),cw=width/factor,ch=height/factor;
            ctx.save();
            if(options.mirror&&kind==='camera'){ctx.translate(width,0);ctx.scale(-1,1);}
            ctx.drawImage(source,(sw-cw)/2,(sh-ch)/2,cw,ch,0,0,width,height);ctx.restore();
            pixels=ctx.getImageData(0,0,width,height).data;
            sampler.dataset.aspect=String(aspect);
            lastSample=now;lastVideoTime=isVideo?video.currentTime:-1;toneKey=key;
            if(options.mode==='assembly')window.rainMediaAssembly?.sample({source,pixels,width,height,kind});
            stats.sampleFrames++;stats.sampleMs=performance.now()-started;stats.sourceRevision=revision;
            if(kind==='camera'&&status.startsWith('Camera connected.'))say('Camera live · '+(stream?.getVideoTracks()[0]?.label||'camera')+'. Omni colors and audio remain in control.');
            const output=document.getElementById('media-status');
            if(output){output.dataset.frames=String(stats.sampleFrames);output.dataset.sourceSize=sw+'×'+sh;output.dataset.ready=String(active());}
        }catch(error){release();say('This media could not be sampled: '+error.message);}
    }
    function strengthAt(x,y){return window.rainMediaAssembly?.strengthAt(x,y)||0;}
    function capture(){}
    function renderView(camera){return camera;}
    function pause(){
        paused=true;video.pause();for(const track of stream?.getVideoTracks()||[])track.enabled=false;refresh();
    }
    function resume(){
        paused=false;lastSample=-Infinity;for(const track of stream?.getVideoTracks()||[])track.enabled=true;
        if(source===video)video.play().catch(()=>say('Media paused. Start camera or load the video again.'));refresh();
    }
    function stop(){release();say('Live depiction stopped. Normal rain continues.');}
    function reset(){stop();Object.assign(options,defaults);refresh();}
    function refresh(){
        const button=document.getElementById('media-camera');if(!button)return;
        button.textContent=kind==='opening'?'Cancel camera':kind==='camera'?'Stop camera':'Start camera';
        button.setAttribute('aria-pressed',String(kind==='camera'));
        document.getElementById('media-next-camera').disabled=kind!=='camera';
        document.getElementById('media-stop').disabled=!source&&kind!=='opening';
        document.getElementById('media-status').textContent=paused&&source?'Depiction paused. Resume in the header to continue.':status;
        for(const key of ['influence','contrast','exposure']){
            document.getElementById('media-'+key).value=options[key];document.getElementById('media-'+key+'-value').textContent=options[key]+'%';
        }document.getElementById('media-mirror').checked=options.mirror;
    }
    function mount(content,before){
        const panel=document.createElement('details');panel.id='settings-media';panel.className='settings-category';
        panel.innerHTML=`<summary>Live depiction<span class="category-note">Camera · local media</span></summary>
            <div class="category-body">
            <div class="settings-row"><button id="media-camera" type="button">Start camera</button><button id="media-next-camera" type="button">Switch camera</button><button id="media-file" type="button">Load image / video</button><button id="media-stop" type="button">Stop depiction</button></div>
            <input id="media-file-input" type="file" accept="image/*,video/*" hidden>
            <p id="media-status" class="settings-hint" role="status"></p>
            <p id="media-assembly-status" class="settings-hint" role="status">Camera detail follows the original moving rain.</p>
            <p class="settings-hint">Live detail · original rain motion</p>
            
            <label for="media-influence">Image influence<output id="media-influence-value" class="settings-value"></output><input id="media-influence" type="range" min="0" max="100" step="1"></label>
            <label for="media-exposure">Image exposure<output id="media-exposure-value" class="settings-value"></output><input id="media-exposure" type="range" min="50" max="200" step="1"></label>
            <label for="media-contrast">Image contrast<output id="media-contrast-value" class="settings-value"></output><input id="media-contrast" type="range" min="50" max="200" step="1"></label>
            <label><input id="media-mirror" type="checkbox"> Mirror camera</label>
            <p class="settings-hint">Your visible body is isolated locally from the background and drawn with the rain's characters and colors. Camera detail adds no separate trail history. Nothing is recorded or uploaded. Near-face reflections exist only during a crossing.</p>
            </div>`;
        content.insertBefore(panel,before);
        // Keep the muted source inspectable without drawing it over the rain.
        video.id='media-source-video';video.hidden=true;panel.appendChild(video);
        document.getElementById('media-camera').onclick=()=>kind==='camera'||kind==='opening'?stop():startCamera();
        document.getElementById('media-next-camera').onclick=nextCamera;
        document.getElementById('media-stop').onclick=stop;
        const input=document.getElementById('media-file-input');
        document.getElementById('media-file').onclick=()=>input.click();
        input.onchange=()=>{loadFile(input.files[0]);input.value='';};
        for(const key of ['influence','contrast','exposure'])document.getElementById('media-'+key).oninput=event=>{
            options[key]=Number(event.target.value);refresh();
        };
        document.getElementById('media-mirror').onchange=event=>{options.mirror=event.target.checked;lastVideoTime=-1;lastSample=-Infinity;};
        const trails=document.getElementById('rain-trails-panel');if(trails&&!document.getElementById('media-border-glints')){const label=document.createElement('label');label.innerHTML='<input id="media-border-glints" type="checkbox" checked> Cell-border glints';trails.appendChild(label);document.getElementById('media-border-glints').onchange=event=>{window.rainBorderGlints.options.enabled=event.target.checked;};}
        refresh();
    }
    window.addEventListener('pagehide',release);
    document.addEventListener('visibilitychange',()=>{
        if(document.hidden)pause();else if(!window.rainSessionControls?.stopped)resume();
    });
    window.rainMedia={mount,present,capture,renderView,strengthAt,startCamera,loadFile,stop,pause,resume,reset,options,stats,refresh,
        get active(){return active();},get stream(){return stream;},get source(){return source;},get status(){return status;},
        get frame(){return window.rainMediaAssembly?.frame||null;},
        // A canvas may also supply frames; used by deterministic visual tests.
        useCanvas(canvas){release();source=canvas;kind='canvas';say('Local canvas source active.');}
    };
})();
