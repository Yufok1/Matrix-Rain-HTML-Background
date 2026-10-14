const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(suppressed,fail=false,live=true){
 const graphs=[],track={kind:'audio',readyState:live?'live':'ended',stops:0,stop(){this.stops++;},getSettings(){return {suppressLocalAudioPlayback:suppressed};}};
 class MediaStream{constructor(tracks){this.tracks=tracks;}getAudioTracks(){return this.tracks;}}
 class AudioContext{
  constructor(){this.state='suspended';this.destination={kind:'speaker'};this.closes=0;graphs.push(this);}
  createMediaStreamSource(stream){assert.equal(stream.getAudioTracks()[0],track);if(fail)throw Error('Audio setup failed');return this.input={connections:[],disconnects:0,connect(node){this.connections.push(node);},disconnect(){this.disconnects++;}};}
  createAnalyser(){return this.analyser={disconnects:0,disconnect(){this.disconnects++;}};}
  createDelay(){throw Error('Tab audio must remain live');}
  async close(){this.closes++;this.state='closed';}
 }
 const window={AudioContext};vm.runInNewContext(fs.readFileSync('rain-tab-audio.js','utf8'),{window,MediaStream});
 return {create:()=>window.RainTabAudio.create(new MediaStream([track])),graphs,track,api:window.RainTabAudio};
}
for(const suppressed of [false,true]){
 const f=fixture(suppressed),graph=f.create(),context=f.graphs[0];
 assert.equal(graph.analyser.fftSize,2048);assert.equal(graph.analyser.smoothingTimeConstant,.2);
 assert.deepEqual(context.input.connections,suppressed?[context.analyser,context.destination]:[context.analyser],'Only suppressed tab playback is monitored; analysis always receives live audio');
 assert.equal(graph.suppressed,suppressed);assert.equal(graph.mode,undefined);assert.equal(f.api.FrameDelay,undefined,'No speech synchronization buffer remains');
 graph.dispose();graph.dispose();assert.equal(context.closes,1);assert.equal(context.input.disconnects,1);assert.equal(f.track.stops,0,'Graph cleanup does not stop capture-owned tracks');
}
const absent=fixture(false,false,false);assert.equal(absent.create(),null);assert.equal(absent.graphs.length,0);
const failing=fixture(false,true);assert.throws(failing.create,/Audio setup failed/);assert.equal(failing.graphs[0].closes,1,'Failed setup closes its audio context');
console.log('PASS live shared-tab analysis, conditional monitoring, no playback delay, source ownership and context cleanup.');
