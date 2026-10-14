const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(available=async()=> 'available'){
 let availabilityCalls=0,installCalls=0,connectCalls=0;const calls=[],scheduled=new Map(),track={kind:'audio',readyState:'live'},stream={getAudioTracks:()=>[track]};
 class Api {static async available(...args){availabilityCalls++;return available(...args);}static install=async()=>{installCalls++;return true;};start(value){assert.equal(value,track);calls.push(this);}abort(){this.aborted=true;}stop(){this.flushes=(this.flushes||0)+1;}}
 Api.prototype.processLocally=false;
 const media={hasAudioSource:true,connectSpeech:async()=>{connectCalls++;return stream;},playbackPaused:false,audioLabel:'loaded video',setWordSync(active){this.sync=active;}};
 const window={SpeechRecognition:Api,rainMedia:media};
 const context=vm.createContext({window,document:{getElementById(){return null;}},performance,setTimeout(fn,ms){if(ms===4000){const id={};scheduled.set(id,fn);return id;}return setTimeout(fn,ms);},clearTimeout(id){if(scheduled.has(id))scheduled.delete(id);else clearTimeout(id);},console});
 vm.runInContext(fs.readFileSync('vendor/canvas5/words.js','utf8'),context);context.Canvas5Words=window.Canvas5Words;
 vm.runInContext(fs.readFileSync('rain-media-words.js','utf8'),context);
 return {words:window.rainMediaWords,calls,media,track,window,scheduled,get availabilityCalls(){return availabilityCalls;},get installCalls(){return installCalls;},get connectCalls(){return connectCalls;}};
}
const result=(text,final=false)=>Object.assign([{transcript:text}],{isFinal:final});
(async()=>{
 const opt=setup();assert.equal(opt.words.enabled,false);
 opt.words.sourceReady();await opt.words.start();opt.words.configure({maxWords:4,bufferMs:1900});await opt.words.resume();await new Promise(setImmediate);
 assert.equal(opt.calls.length,0);assert.equal(opt.availabilityCalls,0);assert.equal(opt.installCalls,0);assert.equal(opt.connectCalls,0,'Source events, start, settings and resume cannot prepare speech without opt-in');
 await opt.words.activate();assert.equal(opt.calls.length,1,'Explicit activation starts recognition');
 opt.words.deactivate();opt.words.sourceReady();await new Promise(setImmediate);assert.equal(opt.calls.length,1,'Disabling applies to future sources');assert.equal(opt.words.nextCharacter(0),null);
 await opt.words.activate();assert.equal(opt.calls.length,2,'Re-enabling needs no media reload');opt.words.resetOptIn();assert.equal(opt.words.enabled,false,'Reset restores opt-in');opt.words.sourceReady();await new Promise(setImmediate);assert.equal(opt.calls.length,2,'Reset cannot silently restart recognition');
 const pack=setup(async()=>pack.availabilityCalls===1?'downloadable':'available');pack.words.sourceReady();await new Promise(setImmediate);assert.equal(pack.installCalls,0);await pack.words.activate();assert.equal(pack.installCalls,1,'Language-pack download follows explicit opt-in');pack.words.deactivate();
 const armed=setup();armed.media.hasAudioSource=false;await armed.words.activate();assert.equal(armed.availabilityCalls,0,'Opt-in without audio does not download anything yet');armed.media.hasAudioSource=true;armed.words.sourceReady();await new Promise(setImmediate);assert.equal(armed.calls.length,1,'Prior opt-in arms the next source for this visit');armed.words.deactivate();
 const f=setup();await f.words.activate();assert.equal(f.calls.length,1);let r=f.calls[0];assert.equal(r.processLocally,true);assert.equal(r.continuous,true);
 r.onstart();assert.equal(f.media.sync,true);assert.equal(f.words.nextCharacter(0),null,'Preparation preserves selected rain; no placeholder alphabet');
 r.onresult({resultIndex:0,results:[result('one two three four five')]});
 let text='';for(let i=0;i<5;i++)text+=f.words.nextCharacter(1);assert.equal(text,'four ');
 text='';for(let i=0;i<6;i++)text+=f.words.nextCharacter(0);assert.equal(text,'three ');
 text='';for(let i=0;i<5;i++)text+=f.words.nextCharacter(2);assert.equal(text,'five ');
 f.words.configure({maxWords:1,bufferMs:1900});text='';for(let i=0;i<4;i++)text+=f.words.nextCharacter(1);assert.equal(text,'five');
 r.onresult({resultIndex:0,results:[result('one two'),result('newest phrase')]});
 r.onresult({resultIndex:0,results:[result('stale correction'),result('newest phrase')]});
 text='';for(let i=0;i<7;i++)text+=f.words.nextCharacter(2);assert.equal(text,'phrase ','Old recognition slots cannot overwrite the current window');
 f.words.tick();assert.equal(f.words.hasWords,true,'Instrumental gaps retain the last lyrics');
 f.words.pause();assert.equal(r.aborted,true);assert.equal(f.words.active,false);await f.words.resume();assert.equal(f.calls.length,2);assert.equal(f.words.hasWords,true,'Restarting recognition preserves the lyrics');
 f.words.stop();assert.equal(f.words.nextCharacter(0),null);assert.equal(f.track.readyState,'live','Stop words leaves playback and audio response alive');
 let resolve;const pending=setup(()=>new Promise(r=>resolve=r));const started=pending.words.activate();await new Promise(setImmediate);pending.words.stop();resolve('available');await started;assert.equal(pending.calls.length,0,'A canceled model check cannot resurrect recognition');
 const paused=setup();paused.media.playbackPaused=true;await paused.words.activate();assert.equal(paused.calls.length,0);paused.media.playbackPaused=false;await paused.words.resume();assert.equal(paused.calls.length,1);paused.words.stop();
 const file=setup();let fileStarts=0;file.media.file={};file.window.rainVideoWords={async start(){fileStarts++;},stop(){}};file.media.connectSpeech=()=>{throw Error('Files must not also open browser speech');};file.words.sourceReady();await file.words.start();await new Promise(setImmediate);assert.equal(fileStarts,0,'A loaded video cannot start a model before opt-in');await file.words.activate();file.words.sourceReady();await new Promise(setImmediate);assert.equal(fileStarts,1);assert.equal(file.calls.length,0);assert.equal(file.availabilityCalls,0,'Whisper files do not prepare a second browser English pack');file.words.stop();
 const switching=setup();let finishDisposal;switching.window.rainVideoWords={whenStopped:()=>new Promise(resolve=>finishDisposal=resolve),stop(){}};const starting=switching.words.activate();await new Promise(setImmediate);assert.equal(switching.availabilityCalls,0,'Browser preparation waits for the file worker to retire');finishDisposal();await starting;assert.equal(switching.calls.length,1);switching.words.stop();
 const cancelSwitch=setup();cancelSwitch.window.rainVideoWords={whenStopped:()=>new Promise(resolve=>finishDisposal=resolve),stop(){}};const awaiting=cancelSwitch.words.activate();await new Promise(setImmediate);cancelSwitch.words.stop();finishDisposal();await awaiting;assert.equal(cancelSwitch.calls.length,0,'Stopping while retiring a source cannot resurrect browser speech');
 console.log('PASS download opt-in for file models and browser packs, reset/deactivation, local source tracks, latest words, stale-result rejection, cancellation and exclusive file/browser recognition.');
})().catch(e=>{console.error(e);process.exitCode=1;});
