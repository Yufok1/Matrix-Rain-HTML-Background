const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'matrix-rain-utility-suite.html'), 'utf8');
function source(name) {
    const matches = html.match(new RegExp('^        (?:async )?function ' + name + '\\([^\\n]*\\) \\{[\\s\\S]*?^        \\}', 'gm'));
    assert.ok(matches?.length, name + ' exists in the application');
    return matches.at(-1);
}
function fixture({capture, wallpaper = false, secure = true, localVideo = false} = {}) {
    let released = 0, connected = 0;
    const elements = Object.fromEntries(['audioReactiveBtn', 'audioStatus', 'audioModeSettings', 'autoOrchestratorBtn', 'secondaryColor'].map(id =>
        [id, {disabled:false, style:{}, textContent:'', previousElementSibling:{style:{}}}]));
    class AudioContext {
        createAnalyser() { return {frequencyBinCount:128}; }
        createMediaStreamSource() { connected++; return {connect(){}}; }
        close() {}
    }
    const graph={context:new AudioContext(),analyser:{frequencyBinCount:1024}};
    const context = vm.createContext({window:{isSecureContext:secure, AudioContext,
        rainMedia:localVideo?{hasAudioSource:true,async connectAudio(){connected++;return graph;}}:undefined,
        wallpaperRegisterAudioListener:wallpaper ? () => {} : undefined},
        navigator:{mediaDevices:capture ? {getDisplayMedia:capture} : {}},
        document:{getElementById:id => elements[id]}, console:{error(){}},
        MatrixRainEngine:{logActivity(){}}, analyzeAudio(){}, resetAudioMotion(){},
        stopAudioReactive() { context.window.rainAudioStarting=false;if(context.activeStream())context.activeStream().getTracks().forEach(t=>t.stop()); released++; }
    });
    vm.runInContext('let rainAudioRequestVersion=0; let audioReactiveActive=false, audioUsesLocalVideo=false, audioStream=null, audioContext=null, audioAnalyser=null, audioBufferLength=0, audioDataArray=null;\n' +
        ['canCaptureRainAudio','updateModeButtons','toggleAudioReactive'].map(source).join('\n') +
        '\nglobalThis.controls={refresh:updateModeButtons,toggle:toggleAudioReactive}; globalThis.activeStream=()=>audioStream;', context);
    return {elements, controls:context.controls, released:()=>released, connected:()=>connected, setAuto:value=>{context.window.autoOrchestratorActive=value;}};
}
function stream(audio = true) {
    const track = {stops:0, events:{}, stop(){this.stops++;}, addEventListener(name,fn){this.events[name]=fn;}};
    return {track, getAudioTracks:()=>audio ? [track] : [], getTracks:()=>[track]};
}
(async () => {
    const unsupported=fixture();
    for (const mode of [null,'orchestrator',null]) {
        unsupported.controls.refresh(mode);
        assert.equal(unsupported.elements.audioReactiveBtn.disabled,true,'Stopping orchestration cannot enable unsupported capture');
        assert.equal(unsupported.elements.audioModeSettings.disabled,true);
        assert.equal(unsupported.elements.autoOrchestratorBtn.disabled,false);
    }
    await unsupported.controls.toggle();
    assert.equal(unsupported.connected(),0);
    const insecure=fixture({capture:()=>{},secure:false});
    insecure.controls.refresh(null);assert.equal(insecure.elements.audioReactiveBtn.disabled,true);
    const video=fixture({localVideo:true,capture(){throw Error('Video must not request screen sharing');}});
    video.controls.refresh(null);assert.equal(video.elements.audioReactiveBtn.disabled,false);
    await video.controls.toggle();assert.equal(video.connected(),1);assert.match(video.elements.audioStatus.textContent,/selected media/);
    assert.equal(video.elements.audioModeSettings.disabled,false);
    await video.controls.toggle();assert.equal(video.elements.audioModeSettings.disabled,true);
    const wallpaper=fixture({wallpaper:true,secure:false});
    wallpaper.controls.refresh(null);assert.equal(wallpaper.elements.audioReactiveBtn.disabled,false);
    await wallpaper.controls.toggle();assert.equal(wallpaper.elements.audioModeSettings.disabled,false);
    await wallpaper.controls.toggle();assert.equal(wallpaper.elements.audioModeSettings.disabled,true);
    const canceled=fixture({capture:()=>Promise.reject(Object.assign(new Error('Canceled'),{name:'NotAllowedError'}))});
    canceled.controls.refresh(null);await canceled.controls.toggle();
    assert.equal(canceled.elements.audioModeSettings.disabled,true);
    assert.equal(canceled.elements.audioReactiveBtn.disabled,false,'A canceled picker can be retried');
    const silentStream=stream(false), silent=fixture({capture:async()=>silentStream});
    silent.controls.refresh(null);await silent.controls.toggle();
    assert.equal(silent.connected(),0,'Do not initialize analysis without an audio track');
    assert.equal(silentStream.track.stops,1,'Release the shared screen when no audio was supplied');
    assert.equal(silent.elements.audioModeSettings.disabled,true);
    let finish;
    const liveStream=stream(), live=fixture({capture:()=>new Promise(resolve=>{finish=resolve;})});
    live.controls.refresh(null);
    assert.equal(live.elements.audioModeSettings.disabled,true);
    const pending=live.controls.toggle();
    assert.equal(live.elements.audioReactiveBtn.disabled,true,'Prevent a second request while the picker is pending');
    assert.equal(live.elements.audioModeSettings.disabled,true);
    finish(liveStream);await pending;
    assert.equal(live.elements.audioModeSettings.disabled,false);
    assert.equal(live.elements.audioReactiveBtn.disabled,false);
    assert.equal(live.elements.autoOrchestratorBtn.disabled,true,'Audio excludes Auto scenes');
    live.controls.refresh(null);
    assert.equal(live.elements.autoOrchestratorBtn.disabled,true,'Refresh cannot unlock Auto during audio');
    liveStream.track.events.ended();
    assert.equal(live.elements.audioModeSettings.disabled,true,'Stopping sharing disables audio settings again');
    assert.equal(live.elements.autoOrchestratorBtn.disabled,false);
    const exclusive=fixture({localVideo:true});exclusive.setAuto(true);exclusive.controls.refresh('orchestrator');
    assert.equal(exclusive.elements.audioReactiveBtn.disabled,true,'Auto excludes audio capture');
    await exclusive.controls.toggle();assert.equal(exclusive.connected(),0,'Direct handler cannot start capture during Auto');
    exclusive.setAuto(false);exclusive.controls.refresh(null);
    assert.equal(exclusive.elements.audioReactiveBtn.disabled,false,'Stopping Auto unlocks audio');
    await exclusive.controls.toggle();assert.equal(exclusive.connected(),1,'Audio starts normally after Auto stops');
    console.log('Unsupported capture, insecure contexts, Wallpaper Engine, canceled/no-audio shares, pending capture and stop-sharing controls passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
