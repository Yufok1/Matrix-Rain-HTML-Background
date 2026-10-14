(function () {
    'use strict';
    const el=id=>document.getElementById(id), num=id=>Number(el(id).value);
    const rounded=value=>Math.round(value*1000)/1000;
    // Wallpaper properties arrive once at startup, sometimes before the panel exists.
    // Receiving a code only stages it; Import remains the explicit apply action.
    let propertyCode='',receiveProperty;
    const listener=window.wallpaperPropertyListener||(window.wallpaperPropertyListener={});
    const previousProperties=listener.applyUserProperties;
    listener.applyUserProperties=function(properties){
        if (previousProperties) previousProperties.call(this,properties);
        const value=properties?.configurationcode?.value;
        if (typeof value==='string') {propertyCode=value;receiveProperty?.(value);}
    };
    function capture(name='') {
        const r=window.matrixRainRendering,t=window.matrixRainTrails;
        return RainSettingsCodec.validate({
            v:9,name,
            rain:{pattern:MatrixRainEngine.rainConfig.pattern,speed:num('rainSpeed'),intensity:num('rainIntensity'),
                density:num('rainDensity'),fontSize:num('characterSize'),primary:el('primaryColor').value,secondary:el('secondaryColor').value,
                characterSet:el('characterSet').value,customCharacters:el('customCharacters').value,
                direction:MatrixRainEngine.rainConfig.direction,reverse:reverseFlowMultiplier===-1},
            audio:{preset:audioColorPreset,beatTurns:audioReverseEnabled,
                fluctuation:colorFluctuationPercent,hueReact:rounded(hueReactivityScale*100),
                saturationGain:rounded(satGainScale*100),brightnessDepth:rounded(brightnessDepthScale*100),
                spread:audioHueSpread,trebleHueRange:audioHighModRange,saturationFloor:satFloor,
                brightnessMin,brightnessMax},
            camera:{enabled:rainCamera.enabled,mode:rainCamera.mode,yaw:rounded(rainCamera.yaw),pitch:rounded(rainCamera.pitch),roll:rounded(rainCamera.roll),
                speeds:Object.fromEntries(Object.entries(rainCamera.speeds).map(([k,v])=>[k,rounded(v*100)]))},
            render:{quality:r.quality,sharp:r.sharp,smooth:r.smooth,glow:rounded(r.glow*100),contrast:rounded(r.contrast*100)},
            words:{...window.rainMediaWords.options},
            trails:{enabled:t.enabled,stepped:t.stepped,minimum:t.minimum,maximum:t.maximum},
            media:{influence:rainMedia.options.influence,exposure:rainMedia.options.exposure,contrast:rainMedia.options.contrast,gamma:rainMedia.options.gamma}
        });
    }
    function apply(settings) {
        // Reject bad input and missing controls before making any changes.
        const s=RainSettingsCodec.validate(settings);
        const required=['rainSpeed','rainIntensity','rainDensity','characterSize','characterSet','customCharacters','rainDirection',
            'primaryColor','secondaryColor','colorFluctuationSlider','hueReactSlider','satGainSlider','brightDepthSlider',
            'render-sharp','render-smooth','render-glow','render-contrast','trail-variety','trail-stepped','trail-shortest','trail-longest',
            'cameraEnabled','cameraYaw','cameraPitch','cameraRoll','cameraSpeed','toggleAudioReverseBtn','reverseFlowBtn'];
        if (!window.matrixRainTrails || required.some(id=>!el(id))) throw Error('Settings are still loading. Try again in a moment.');
        const set=(id,value,handler)=>{el(id).value=value;handler();};
        const check=(id,value)=>{el(id).checked=value;el(id).onchange();};
        setRainPattern(s.rain.pattern,document.querySelector(`.pattern-btn[onclick*="'${s.rain.pattern}'"]`));
        set('rainSpeed',s.rain.speed,updateRainSpeed);set('rainIntensity',s.rain.intensity,updateRainIntensity);
        set('rainDensity',s.rain.density,updateRainDensity);set('characterSize',s.rain.fontSize,updateCharacterSize);
        el('customCharacters').value=s.rain.customCharacters;set('characterSet',s.rain.characterSet,updateCharacterSet);
        el('primaryColor').value=s.rain.primary;el('secondaryColor').value=s.rain.secondary;updateRainColors();
        if ((reverseFlowMultiplier===-1)!==s.rain.reverse) toggleReverseFlow();
        if (audioReverseEnabled!==s.audio.beatTurns) toggleAudioReverse();
        rainCamera.setEnabled(s.camera.enabled);set('rainDirection',s.rain.direction,updateRainDirection);
        setColorPreset(s.audio.preset);
        set('colorFluctuationSlider',s.audio.fluctuation,updateColorFluctuation);
        set('hueReactSlider',s.audio.hueReact,updateHueReactivity);
        set('satGainSlider',s.audio.saturationGain,updateSaturationGain);
        set('brightDepthSlider',s.audio.brightnessDepth,updateBrightnessDepth);
        audioHueSpread=s.audio.spread;audioHighModRange=s.audio.trebleHueRange;satFloor=s.audio.saturationFloor;
        brightnessMin=s.audio.brightnessMin;brightnessMax=s.audio.brightnessMax;
        for (const mode of Object.keys(rainCamera.speeds)) rainCamera.speeds[mode]=s.camera.speeds[mode]/100;
        for (const axis of ['yaw','pitch','roll']) rainCamera[axis]=s.camera[axis];
        rainCamera.setMode(s.camera.mode);rainCamera.refreshControls();
        try {localStorage.setItem('matrixRain.preview.calibratedCameraSpeeds',JSON.stringify(rainCamera.speeds));} catch (_) {}
        document.querySelector(`[data-quality="${s.render.quality}"]`).onclick();
        check('render-sharp',s.render.sharp);check('render-smooth',s.render.smooth);
        set('render-glow',s.render.glow,()=>el('render-glow').oninput());
        set('render-contrast',s.render.contrast,()=>el('render-contrast').oninput());
        check('trail-variety',s.trails.enabled);check('trail-stepped',s.trails.stepped);
        el('trail-shortest').value=s.trails.minimum;el('trail-longest').value=s.trails.maximum;el('trail-shortest').oninput();
        if(window.rainMedia){Object.assign(rainMedia.options,s.media);rainMedia.saveAppearance?.();rainMedia.refresh();}
        window.rainMediaWords?.configure(s.words);
        window.rainSettingsUI?.refresh();
        return s;
    }
    function defaults(){return RainSettingsCodec.validate({v:9,name:'',
        rain:{pattern:'classic',speed:66,intensity:70,density:50,fontSize:10,primary:'#00ff41',secondary:'#00cc33',characterSet:'katakana',customCharacters:'',direction:'down',reverse:false},
        audio:{preset:'zen',beatTurns:false,fluctuation:100,hueReact:60,saturationGain:60,brightnessDepth:80,spread:.8,trebleHueRange:16,saturationFloor:45,brightnessMin:52,brightnessMax:80},
        camera:{enabled:true,mode:'fixed',yaw:0,pitch:0,roll:0,speeds:{showcase:25,corkscrew:25,gyroscope:25}},
        words:{maxWords:3,bufferMs:1900,verticalOrder:'down'},render:{quality:'balanced',sharp:true,smooth:true,glow:15,contrast:100},trails:{enabled:false,stepped:true,minimum:12,maximum:100},media:{influence:100,exposure:100,contrast:100,gamma:100}
    });}
    window.rainSettingsShare={capture,apply,defaults,export:(name='')=>RainSettingsCodec.encode(capture(name)),import:blob=>apply(RainSettingsCodec.decode(blob))};
    window.addEventListener('DOMContentLoaded',()=>{
        const panel=document.createElement('details');panel.id='rain-share-panel';
        panel.style.cssText='border:1px solid #00ff41;padding:12px;margin:12px 0;background:#071009;text-align:left';
        panel.innerHTML=`<summary style="cursor:pointer"><strong>Save / share configuration</strong></summary>
            <p style="font-size:12px;margin:10px 0">Copy your rain, audio response, camera and rendering settings into one shareable code. Import restores those choices without starting audio capture.</p>
            <label for="rain-share-name">Configuration name (optional)</label>
            <input id="rain-share-name" type="text" maxlength="60" style="width:100%;margin:6px 0 10px;background:#000;color:#00ff41;border:1px solid #29753d;padding:7px;box-sizing:border-box">
            <label for="rain-share-blob">Configuration code</label>
            <textarea id="rain-share-blob" rows="4" spellcheck="false" autocapitalize="off" aria-describedby="rain-share-status" style="width:100%;box-sizing:border-box;background:#000;color:#a7f8bc;border:1px solid #29753d;margin:6px 0;padding:8px;font:12px monospace;resize:vertical"></textarea>
            <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="rain-share-export" type="button">Export</button><button class="btn" id="rain-share-copy" type="button">Copy code</button><button class="btn" id="rain-share-paste" type="button">Paste code</button><button class="btn" id="rain-share-import" type="button">Import</button></div>
            <p id="rain-share-wallpaper-help" hidden style="font-size:12px;margin:10px 0">If clipboard paste is unavailable, paste into <strong>Configuration code</strong> in Wallpaper Engine’s Installed tab, then click Import here.</p>
            <p id="rain-share-status" role="status" aria-live="polite" style="font-size:12px;margin:10px 0 0">Export your settings, or paste a code and import it.</p>`;
        el('rain-camera-panel').before(panel);
        const blob=el('rain-share-blob'),name=el('rain-share-name'),status=el('rain-share-status');
        const wallpaper=typeof window.wallpaperRegisterAudioListener==='function';
        el('rain-share-wallpaper-help').hidden=!wallpaper;
        let revision=0,cancelPaste;
        blob.addEventListener('input',()=>revision++);
        const stage=(text,message)=>{
            // Decode completely before replacing the box; malformed input cannot
            // destroy a saved/exported code or apply a partial configuration.
            RainSettingsCodec.decode(text);
            revision++;blob.value=text.trim();status.textContent=message;
        };
        blob.addEventListener('paste',event=>{
            const text=event.clipboardData?.getData('text/plain');
            if (typeof text!=='string') return;
            event.preventDefault();revision++;
            try {stage(text,'Code pasted. Click Import to apply.');}
            catch(error){status.textContent='Clipboard code: '+error.message;}
        });
        receiveProperty=text=>{
            revision++;
            if (!text.trim()) return;
            try {stage(text,'Code received from Wallpaper Engine. Click Import to apply.');}
            catch(error){status.textContent='Wallpaper Engine code: '+error.message;}
        };
        for (const input of [blob,name]) input.addEventListener('keydown',event=>event.stopPropagation());
        el('rain-share-export').onclick=()=>{revision++;try{blob.value=rainSettingsShare.export(name.value);status.textContent='Exported. Copy the code to save or share it.';}catch(error){status.textContent=error.message;}};
        el('rain-share-import').onclick=()=>{revision++;try{const s=rainSettingsShare.import(blob.value);name.value=s.name;status.textContent='Imported'+(s.name?' “'+s.name+'”':'')+'. Audio access is unchanged.';}catch(error){status.textContent=error.message;}};
        el('rain-share-paste').onclick=async()=>{
            cancelPaste?.();
            const button=el('rain-share-paste'),requested=++revision;
            const fallback=wallpaper?'Clipboard paste is unavailable here. Paste into Configuration code in Wallpaper Engine’s Installed tab, then click Import here.':'Clipboard paste is unavailable. Paste the code into the box, then click Import.';
            // A host may leave its permission/read promise pending indefinitely.
            // Keep retry available and retire the old attempt before starting another.
            let timer,retire;
            const deadline=new Promise((_,reject)=>{
                timer=setTimeout(()=>reject(Error('Clipboard response timed out')),4000);
                retire=()=>reject(Error('Clipboard request replaced'));
            });
            cancelPaste=retire;button.setAttribute('aria-busy','true');
            status.textContent='Reading clipboard…';
            try {
                if (!navigator.clipboard?.readText) throw Error('Clipboard API unavailable');
                const text=await Promise.race([navigator.clipboard.readText(),deadline]);
                if (requested!==revision) return;
                try {stage(text,'Code pasted. Click Import to apply.');}
                catch(error){status.textContent='Clipboard code: '+error.message;}
            } catch (_) {if(requested===revision)status.textContent=fallback;}
            finally {
                clearTimeout(timer);
                if(cancelPaste===retire){cancelPaste=null;button.removeAttribute('aria-busy');}
            }
        };
        el('rain-share-copy').onclick=async()=>{
            if (!blob.value) el('rain-share-export').onclick();
            if (!blob.value) return;
            try {await navigator.clipboard.writeText(blob.value);status.textContent='Configuration code copied.';}
            catch (_) {blob.focus();blob.select();status.textContent='Code selected. Use Copy or Ctrl+C.';}
        };
        if (propertyCode.trim()) receiveProperty(propertyCode);
    });
})();
