import './trails/rain-trails.js';
import {createSettingsBeacon} from './rain-settings-beacon.js?v=0b7cda11297a';

// Move the existing controls, preserving their handlers and simulation state.
window.addEventListener('DOMContentLoaded',()=>{
    const el=id=>document.getElementById(id), modal=document.querySelector('.matrix-modal');
    const content=modal.querySelector('.modal-content'),header=modal.querySelector('.modal-header');
    const category=(id,title,note='',open=false)=>{
        const details=document.createElement('details');details.id=id;details.className='settings-category';details.open=open;
        details.innerHTML=`<summary>${title}<span class="category-note">${note}</span></summary><div class="category-body"></div>`;
        return details;
    };
    const sub=(title)=>{const details=document.createElement('details');details.className='settings-subcategory';details.innerHTML=`<summary>${title}</summary><div></div>`;return details;};
    const row=(...nodes)=>{const box=document.createElement('div');box.className='settings-row';box.append(...nodes);return box;};
    const hint=text=>{const p=document.createElement('p');p.className='settings-hint';p.textContent=text;return p;};
    const control=id=>{const item=el(id).closest('.control-item');const label=item.querySelector('label');if(label)label.htmlFor=id;return item;};
    const rain=category('settings-rain','Rain','Size · density · trails',!matchMedia('(max-width:700px)').matches),rb=rain.lastElementChild;
    const density=control('rainDensity'),size=control('characterSize');
    // Speed is a reversed percentage control; align the initial slider with
    // the actual delay so export/import preserves manual playback speed.
    el('rainSpeed').value=101-MatrixRainEngine.rainConfig.speed;
    density.querySelector('label').textContent='Density';size.querySelector('label').textContent='Character size';
    for(const id of ['rainDensity','rainSpeed','rainIntensity']){
        const output=document.createElement('output');output.setAttribute('for',id);output.id=id+'Value';output.className='settings-value';control(id).querySelector('label').append(output);
    }
    rb.append(density,size);
    const manual=document.createElement('fieldset');manual.id='rain-manual-settings';
    const patterns=document.querySelector('.pattern-btn').parentElement;patterns.classList.add('pattern-controls');
    manual.append(hint('Manual appearance. Audio response takes over speed, intensity, direction, colors and characters.'),patterns,
        control('rainSpeed'),control('rainIntensity'),control('characterSet'),control('rainDirection'));
    const colors=document.createElement('div');colors.className='settings-grid';colors.append(control('primaryColor'),control('secondaryColor'));manual.append(colors);
    const manualDetails=sub('Manual appearance');manualDetails.lastElementChild.append(manual);rb.append(manualDetails);
    const auto=el('autoOrchestratorBtn'),reverse=el('reverseFlowBtn'),shuffle=document.querySelector('[onclick="activateChaosRandomizer()"]');
    shuffle.id='rain-shuffle';rb.append(row(reverse,shuffle,auto));
    const trailDetails=sub('3D trails'),trailField=document.createElement('fieldset');trailField.id='rain-trail-settings';
    trailField.append(el('rain-trails-panel'));trailDetails.lastElementChild.append(trailField,hint('Tail length and stepped fade apply to the 3D camera view.'));rb.append(trailDetails);

    const audio=category('settings-audio','Audio response','Motion · palette'),ab=audio.lastElementChild;
    const audioTitle=document.createElement('span');audioTitle.className='audio-color-label';audioTitle.setAttribute('aria-label','Audio response');
    const label='Audio response',letterCount=label.replace(/\s/g,'').length;let letter=0;
    for(const character of label){
        if(character===' '){audioTitle.append(document.createTextNode(' '));continue;}
        const span=document.createElement('span');span.textContent=character;span.className='audio-letter-'+Math.floor(letter++*6/(letterCount-1));span.setAttribute('aria-hidden','true');audioTitle.append(span);
    }
    audio.firstElementChild.firstChild.replaceWith(audioTitle);
    const audioField=el('audioModeSettings'),palette=document.createElement('div');palette.className='settings-row';palette.id='audio-palettes';palette.setAttribute('role','group');palette.setAttribute('aria-label','Audio palette');
    for(const button of document.querySelectorAll('button[onclick^="setColorPreset("]')){
        button.dataset.palette=button.getAttribute('onclick').match(/'([^']+)'/)[1];palette.append(button);
    }
    const defaultPalette=document.createElement('button');defaultPalette.type='button';defaultPalette.className='btn';defaultPalette.dataset.palette='default';defaultPalette.textContent='Default';defaultPalette.onclick=()=>setColorPreset('default');palette.prepend(defaultPalette);
    const beat=el('toggleAudioReverseBtn'),beatStatus=el('beatTurnPolicyStatus'),colorControls=document.querySelector('.audio-color-controls');
    const advanced=sub('Color response tuning');advanced.lastElementChild.append(...Array.from(colorControls.children).slice(1));
    audioField.replaceChildren(palette,colorControls,advanced,beat,beatStatus,hint('New letters follow the sound. Each keeps its assigned color until it fades.'));
    document.querySelector('label[for="hueReactSlider"]').textContent='Hue range';
    document.querySelector('label[for="satGainSlider"]').textContent='Saturation response';
    document.querySelector('label[for="brightDepthSlider"]').textContent='Brightness response';
    ab.append(el('audioReactiveBtn'),el('audioStatus'),el('audioVisualizer'),audioField);

    const camera=category('settings-camera','Camera','Flat · 3D'),cb=camera.lastElementChild;
    const cameraPanel=el('rain-camera-panel');cb.append(cameraPanel);
    cameraPanel.querySelector('#cameraReset').remove(); // Enable camera is the single flat/3D switch.
    const pose=sub('Manual orientation');
    for(const axis of ['Yaw','Pitch','Roll']){const input=cameraPanel.querySelector('#camera'+axis);pose.lastElementChild.append(input.previousElementSibling,input);}
    cb.append(pose);
    const render=category('settings-rendering','Rendering','Clarity · performance'),renderField=document.createElement('fieldset');renderField.id='rain-render-settings';renderField.append(el('rain-rendering-panel'));render.lastElementChild.append(renderField,hint('Rendering options apply to the 3D camera view.'));
    const share=el('rain-share-panel');share.className='settings-category';share.removeAttribute('style');share.querySelector('summary').innerHTML='Configurations<span class="category-note">Copy · paste · share</span>';
    share.querySelector('p').textContent='Share every visual setting in one code. Import keeps listening, playback and Auto Orchestrator activation as they are.';
    content.replaceChildren(rain,audio,camera,render,share);

    const toggle=el('minimizeBtn');
    const logo='<svg class="settings-launch-icon" viewBox="0 0 108 108" aria-hidden="true"><path fill="currentColor" d="M24,20h8v36h-8z M40,28h8v52h-8z M56,16h8v44h-8z M72,38h8v50h-8z"/><path fill="currentColor" opacity=".45" d="M24,61h8v10h-8z M40,85h8v10h-8z M56,65h8v10h-8z"/></svg>';
    toggle.innerHTML=logo+'<span class="settings-collapse-icon" aria-hidden="true">−</span>';
    window.rainSettingsBeacon=createSettingsBeacon(toggle,()=>({
        direction:MatrixRainEngine.rainConfig.direction,
        reverse:reverseFlowMultiplier,
        view:rainCamera.enabled?rainCamera.viewRotation():null
    }));
    header.querySelector('.minimized-header-text').remove();
    header.querySelector('.full-header-text').innerHTML='MATRIX RAIN OMNI<small class="panel-drag-hint">Settings · drag to reposition</small>';
    const headerActions=toggle.parentElement;headerActions.className='settings-header-actions';
    const stop=document.createElement('button');stop.id='rain-emergency-stop';stop.type='button';stop.textContent='Stop';stop.title='Emergency stop — preserve this session';
    stop.onclick=()=>rainSessionControls.stopped?rainSessionControls.resume():rainSessionControls.stop();
    const reset=document.createElement('button');reset.id='rain-reset';reset.type='button';reset.textContent='Reset';reset.title='Restore defaults and restart rain';reset.onclick=()=>rainSessionControls.reset();
    headerActions.prepend(stop,reset);
    window.rainSettingsUI={refresh(){
        const collapsed=modal.classList.contains('minimized');
        toggle.setAttribute('aria-label',collapsed?'Open settings':'Collapse settings');toggle.setAttribute('aria-expanded',String(!collapsed));toggle.title=collapsed?'Settings · M':'Collapse settings · M';
        const isAudio=audioReactiveActive||rainSessionControls.audioPaused;
        el('rain-manual-settings').disabled=isAudio;
        el('audioModeSettings').disabled=!isAudio;
        el('rain-trail-settings').disabled=el('rain-render-settings').disabled=!rainCamera.enabled;
        reverse.textContent='Reverse flow';reverse.setAttribute('aria-pressed',String(reverseFlowMultiplier===-1));
        auto.textContent=autoOrchestratorActive?'Stop auto scenes':'Auto scenes';auto.setAttribute('aria-pressed',String(autoOrchestratorActive));
        el('audioReactiveBtn').textContent=isAudio?'Stop audio response':'Start audio response';el('audioReactiveBtn').setAttribute('aria-pressed',String(isAudio));
        el('audioReactiveBtn').disabled=rainSessionControls.stopped||autoOrchestratorActive||!canCaptureRainAudio();auto.disabled=rainSessionControls.stopped||audioReactiveActive;
        stop.textContent=rainSessionControls.stopped?'Resume':'Stop';stop.title=rainSessionControls.stopped?'Resume with your settings intact':'Emergency stop — preserve this session';
        stop.dataset.state=rainSessionControls.stopped?'stopped':'running';
        header.querySelector('.panel-drag-hint').textContent=rainSessionControls.stopped?'Stopped · settings preserved':'Settings · drag to reposition';
        beat.textContent='Beat turns';
        for(const b of palette.children)b.setAttribute('aria-pressed',String(b.dataset.palette===audioColorPreset));
        for(const b of patterns.children)b.setAttribute('aria-pressed',String(b.classList.contains('active')));
        shuffle.textContent='Shuffle once';shuffle.disabled=audioReactiveActive;
        for(const id of ['rainDensity','rainSpeed','rainIntensity'])el(id+'Value').textContent=el(id).value+'%';
    }};
    new MutationObserver(()=>rainSettingsUI.refresh()).observe(modal,{attributes:true,attributeFilter:['class']});
    // Refresh after existing handlers; audio startup is async and announces
    // state through status/buttons. No polling or work in the animation loop.
    content.addEventListener('click',()=>queueMicrotask(()=>rainSettingsUI.refresh()));
    content.addEventListener('input',()=>rainSettingsUI.refresh());
    new MutationObserver(()=>rainSettingsUI.refresh()).observe(el('audioStatus'),{childList:true,subtree:true});
    document.addEventListener('keydown',event=>{
        if(event.ctrlKey||event.metaKey||event.altKey||event.repeat||event.target.isContentEditable||event.target.closest('input,textarea,select'))return;
        if(event.key.toLowerCase()==='m'){toggleMatrixModal();event.preventDefault();}
        if(event.key==='Escape'&&!modal.classList.contains('minimized')){toggleMatrixModal();toggle.focus();event.preventDefault();}
    });
    for(const b of modal.querySelectorAll('.setting-choice'))if(b.dataset.value==='toward')b.textContent='Toward camera';else if(b.dataset.value==='away')b.textContent='Away from camera';
    document.querySelector('[data-control="characterSet"]').setAttribute('aria-label','Character set');
    document.querySelector('[data-control="rainDirection"]').setAttribute('aria-label','Rain direction');
    for(const id of ['rainSpeed','rainIntensity','rainDensity'])el(id).oninput=el(id).onchange;
    const orchestrate=window.orchestrateRandomChange;
    window.orchestrateRandomChange=()=>{orchestrate();rainSettingsUI.refresh();};
    window.rainSettingsUI.refresh();
    modal.dataset.settingsReady='true';
    rainSettingsBeacon.update();
});
