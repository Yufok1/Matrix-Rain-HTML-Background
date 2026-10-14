const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('rain-media-depiction.js','utf8');
function fixture(){
 const elements=new Map(),documentEvents={},graphs=[],draws=[];let blocked=false,plays=0,sourceCount=0;
 const element=()=>({style:{},dataset:{},hidden:false,disabled:false,setAttribute(){},appendChild(){},querySelector(){return null;},
  set innerHTML(text){for(const [,id] of text.matchAll(/id="([^"]+)"/g))elements.set(id,element());}});
 const video={...element(),readyState:4,videoWidth:1280,videoHeight:720,currentTime:0,paused:true,muted:true,async play(){if(blocked)throw Object.assign(Error('User gesture needed'),{name:'NotAllowedError'});plays++;this.paused=false;},pause(){this.paused=true;},load(){},removeAttribute(){}};
 const window={addEventListener(){},rainMediaAssembly:{reset(){},sample(){}}};
 const navigator={mediaDevices:{}};
 class MediaStream{constructor(tracks){this.tracks=tracks;}getTracks(){return this.tracks;}getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio');}getVideoTracks(){return this.tracks.filter(t=>t.kind==='video');}}
 class AudioContext{constructor(){this.state='suspended';this.closes=0;this.destination={};graphs.push(this);}async resume(){this.state='running';}async suspend(){this.state='suspended';}close(){this.closes++;this.state='closed';}createMediaElementSource(value){assert.equal(value,video);sourceCount++;return {connect(){}};}createAnalyser(){return {frequencyBinCount:1024};}}
 window.AudioContext=AudioContext;
 const document={hidden:false,createElement(type){return type==='video'?video:type==='canvas'?{dataset:{},getContext(){return {clearRect(){},save(){},restore(){},drawImage(...args){draws.push(args);},getImageData(x,y,w,h){return {data:new Uint8ClampedArray(w*h*4)};}};}}:element();},getElementById:id=>elements.get(id),addEventListener(type,callback){documentEvents[type]=callback;}};
 vm.runInNewContext(code,{window,document,innerWidth:1024,innerHeight:896,performance:{now(){return 0;}},Uint8ClampedArray,navigator,MediaStream,URL:{createObjectURL(){return 'blob:local-video';},revokeObjectURL(){}},localStorage:{getItem(){return null;}},Math,JSON,console});
 window.rainMedia.mount({insertBefore(){}},null);
 return {media:window.rainMedia,window,navigator,MediaStream,document,draws,el:id=>elements.get(id),video,graphs,block(value){blocked=value;},get plays(){return plays;},get sourceCount(){return sourceCount;},visibility(){documentEvents.visibilitychange();}};
}
(async()=>{
 const f=fixture(),file={type:'video/mp4'};
 await f.media.loadFile(file);assert.equal(f.media.connectSpeech,undefined,'Loaded video exposes no recognition route');assert.equal(f.media.hasVideo,true);assert.equal(f.video.muted,false);assert.equal(f.video.paused,false);assert.equal(f.el('media-video-controls').hidden,false);
 f.media.present(100);assert.deepEqual(f.draws[0],[f.video,0,0,1280,720,0,0,384,336],'The full video fills every viewport pixel without padding or a crop');
 await f.el('media-play').onclick();assert.equal(f.video.paused,true);
 const plays=f.plays;f.media.pause();f.media.resume();await Promise.resolve();assert.equal(f.plays,plays,'Session resume preserves a deliberately paused video');
 await f.el('media-play').onclick();assert.equal(f.video.paused,false);
 f.el('media-sound').onclick();assert.equal(f.video.muted,true);assert.equal(f.el('media-sound').textContent,'Unmute video');
 f.el('media-sound').onclick();assert.equal(f.video.muted,false);
 const graph=await f.media.connectAudio();assert.equal(graph.context.state,'running');assert.equal(await f.media.connectAudio(),graph);assert.equal(f.sourceCount,1);
 f.media.pause();assert.equal(f.video.paused,true);assert.equal(graph.context.state,'suspended');f.media.resume();await new Promise(setImmediate);assert.equal(graph.context.state,'running');assert.equal(f.video.paused,false);
 f.media.stop();assert.equal(f.media.hasVideo,false);assert.equal(graph.context.state,'suspended');assert.equal(graph.context.closes,0);
 await f.media.loadFile(file);assert.equal(await f.media.connectAudio(),graph);assert.equal(f.sourceCount,1,'A second video reuses the single MediaElementAudioSource');
 f.block(true);await f.media.loadFile(file);assert.equal(f.media.hasVideo,true,'Autoplay denial retains a playable file');assert.match(f.media.status,/Click Play video/);f.block(false);await f.el('media-play').onclick();assert.equal(f.video.paused,false);
 // Audio failures cannot tear down shared video.
 const track=kind=>({kind,readyState:'live',listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},stop(){this.readyState='ended';},clone(){return track(this.kind);},end(){this.readyState='ended';this.listeners.ended?.();}});
 const tab=fixture(),picture=track('video'),sound=track('audio'),capture=new tab.MediaStream([picture,sound]);
 tab.navigator.mediaDevices.getDisplayMedia=async()=>capture;
 tab.window.RainTabAudio={create(){throw Error('Audio setup unavailable');}};
 await tab.media.startTab();assert.equal(tab.media.source,tab.video);assert.equal(picture.readyState,'live','Audio setup failure preserves the live picture');assert.match(tab.media.status,/Audio analysis could not start/);assert.equal(tab.media.connectSpeech,undefined);
 sound.end();assert.equal(tab.media.source,tab.video,'Ending audio must not close the picture');assert.equal(picture.readyState,'live');picture.end();assert.equal(tab.media.source,null,'Ending video releases the share');
 // Reproduce the actual AbortError: picker focus hides Omni while its
 // video.play promise is pending. The capture survives and resumes on return.
 const race=fixture(),rv=track('video'),ra=track('audio'),raceStream=new race.MediaStream([rv,ra]);
 race.navigator.mediaDevices.getDisplayMedia=async()=>raceStream;race.window.RainTabAudio={create(){return null;}};
 const normalPlay=race.video.play.bind(race.video);race.video.play=async()=>{race.document.hidden=true;race.media.pause();throw Object.assign(Error('play request interrupted by a call to pause'),{name:'AbortError'});};
 await race.media.startTab();assert.equal(race.media.source,race.video,'Visibility interruption cannot tear down the share');assert.equal(rv.readyState,'live');assert.doesNotMatch(race.media.status,/Could not share/);
 race.video.play=normalPlay;race.document.hidden=false;race.visibility();await new Promise(setImmediate);assert.equal(race.video.paused,false);assert.equal(rv.enabled,true);race.media.stop();
 // Even if Omni becomes visible before the old rejection is delivered,
 // the interrupted play still belongs to the preceding visibility operation.
 const resumed=fixture(),bv=track('video'),ba=track('audio');resumed.navigator.mediaDevices.getDisplayMedia=async()=>new resumed.MediaStream([bv,ba]);resumed.window.RainTabAudio={create(){return null;}};
 const normalResumePlay=resumed.video.play.bind(resumed.video);let firstPlay=true;resumed.video.play=async()=>{if(!firstPlay)return normalResumePlay();firstPlay=false;resumed.document.hidden=true;resumed.media.pause();resumed.document.hidden=false;resumed.media.resume();throw Object.assign(Error('old play interrupted'),{name:'AbortError'});};
 await resumed.media.startTab();await new Promise(setImmediate);assert.equal(resumed.media.source,resumed.video,'An old play rejection cannot undo a successfully resumed share');assert.equal(bv.readyState,'live');assert.equal(resumed.video.paused,false);resumed.media.stop();
 const hidden=fixture(),hv=track('video'),hiddenStream=new hidden.MediaStream([hv]);hidden.document.hidden=true;
 hidden.navigator.mediaDevices.getDisplayMedia=async()=>hiddenStream;hidden.window.RainTabAudio={create(){return null;}};
 await hidden.media.startTab();assert.equal(hidden.plays,0,'An already hidden page adopts the capture without starting a doomed play request');assert.equal(hv.readyState,'live');hidden.media.stop();
 const pendingShare=fixture();let accept,shareRequests=0;pendingShare.navigator.mediaDevices.getDisplayMedia=()=>{shareRequests++;return new Promise(resolve=>accept=resolve);};
 const pendingStart=pendingShare.media.startTab();await pendingShare.media.startTab();assert.equal(shareRequests,1,'Repeated clicks cannot start competing share requests');pendingShare.media.stop();const pv=track('video');accept(new pendingShare.MediaStream([pv]));await pendingStart;assert.equal(pv.readyState,'ended','A canceled picker cannot reconnect later');
 // Stopping visual/audio response must leave audible video playback intact.
 const html=fs.readFileSync('matrix-rain-utility-suite.html','utf8');
 const stop=html.match(/^        function stopAudioReactive\(\) \{[\s\S]*?^        \}/m)[0];
 const shared=new AudioContextForTest();function AudioContextForTest(){this.closes=0;this.close=()=>this.closes++;}
 const context=vm.createContext({window:{rainAudioPalette:{active:true}},cancelAnimationFrame(){}});
 vm.runInContext('let rainAudioRequestVersion=0,audioAnimationFrame=null,audioStream=null,audioContext=null,audioUsesLocalVideo=true,audioAnalyser={},audioDataArray={};'+stop+';globalThis.setContext=value=>audioContext=value;',context);
 context.setContext(shared);context.stopAudioReactive();assert.equal(shared.closes,0,'Audio mode does not close a video-owned context');
 console.log('PASS audible playback, retryable autoplay denial, Play/Pause/Mute, header pause/resume, single reusable audio graph, live tab audio, independent shared video/audio, picker visibility race, duplicate/canceled share requests, no video silence when analysis stops.');
})().catch(error=>{console.error(error);process.exitCode=1;});
