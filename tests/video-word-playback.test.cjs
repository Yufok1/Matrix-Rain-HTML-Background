const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 let worker,holds=0,releases=0,userPaused=false;const published=[],video={paused:false,currentTime:0};
 const media={source:video,holdWordsPlayback(){holds++;video.paused=true;},resumeWordsPlayback(){releases++;if(!userPaused)video.paused=false;}};
 const window={rainMedia:media,rainMediaWords:{options:{maxWords:3}},rainSessionControls:{stopped:false},OfflineAudioContext:class {async decodeAudioData(){return {length:40*16000,numberOfChannels:1,getChannelData(){return new Float32Array(40*16000).fill(.1);}};}}};
 class Worker {constructor(){worker=this;this.messages=[];}postMessage(message){this.messages.push(message);if(message.action==='load')queueMicrotask(()=>this.onmessage({data:{event:'ready'}}));}terminate(){this.terminated=true;}}
 const context=vm.createContext({window,document:{hidden:false,getElementById(){return null;}},navigator:{},Worker,Float32Array,Math,Error,setTimeout(fn){return fn;},queueMicrotask,console});
 vm.runInContext(fs.readFileSync('rain-word-timeline.js','utf8'),context);vm.runInContext(fs.readFileSync('rain-video-words.js','utf8'),context);
 return {words:window.rainVideoWords,window,media,video,published,file:{async arrayBuffer(){return new ArrayBuffer(1);}},get worker(){return worker;},get holds(){return holds;},get releases(){return releases;},setUserPause(){userPaused=true;video.paused=true;},result(text,stamp){const job=worker.messages.filter(m=>m.action==='recognize').at(-1);worker.onmessage({data:{event:'result',id:job.id,seconds:.1,chunks:[{text,timestamp:stamp}]}});}};
}
(async()=>{
 const f=fixture();await f.words.start(f.file,f.video,text=>f.published.push(text),()=>{});assert.equal(f.holds,0,'Background preparation must not pause playback');assert.equal(f.video.paused,false);
 f.result('hello',[0,1]);assert.equal(f.video.paused,false);assert.equal(f.releases,0,'Recognition must not resume playback either');assert.equal(f.published.at(-1),'hello');
 f.video.currentTime=25;f.words.tick();assert.equal(f.holds,0,'A missing future block cannot pause playback');assert.equal(f.video.paused,false);assert.equal(f.published.at(-1),'hello','Lyrics survive an uncovered instrumental section');assert.ok(!f.published.includes(''),'Recognition never emits a blank fallback during playback');
 // A late lookahead result remains tied to its own audio interval; the next
 // request catches up to the playback clock instead of replaying old jobs.
 f.result('next',[2,3]);assert.equal(f.video.paused,false);const nextJob=f.worker.messages.filter(m=>m.action==='recognize').at(-1);assert.equal(nextJob.pcm.length/16000,14);
 f.words.stop();assert.equal(f.words.active,false);
 const paused=fixture();paused.setUserPause();await paused.words.start(paused.file,paused.video,()=>{},()=>{});paused.result('ready',[0,1]);assert.equal(paused.releases,0,'Preparation owns no video playback controls');assert.equal(paused.video.paused,true,'Preparation never overrides manual Pause');paused.words.stop();
 const canceled=fixture();let decode; canceled.window.OfflineAudioContext=class {decodeAudioData(){return new Promise(resolve=>decode=resolve);}};const pending=canceled.words.start(canceled.file,canceled.video,()=>{},()=>{});await new Promise(setImmediate);assert.equal(canceled.video.paused,false,'Video continues even while decoding is unresolved');assert.equal(canceled.holds,0);canceled.words.stop();decode({length:1,numberOfChannels:1,getChannelData(){return new Float32Array(1);}});await pending;assert.equal(canceled.worker,undefined,'Canceled decoding cannot start a recognizer');
 console.log('PASS nonblocking preparation, uninterrupted playback under recognition backlog, lyric retention, manual pause, media-clock catch-up and cancellation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
