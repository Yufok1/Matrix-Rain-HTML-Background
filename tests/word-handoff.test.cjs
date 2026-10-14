const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const track={kind:'audio',readyState:'live'},stream={getAudioTracks:()=>[track]};let recognizer,clears=0;
class Speech {static available=async()=> 'available';static install=async()=>true;start(value){assert.equal(value,track);recognizer=this;}abort(){}}
Speech.prototype.processLocally=false;
const gpu={invalidate:false},window={SpeechRecognition:Speech,rainMedia:{hasAudioSource:true,playbackPaused:false,connectSpeech:async()=>stream,setWordSync(){}}};
const context=vm.createContext({window,rainCameraGPU:gpu,MatrixRainEngine:{rainConfig:{direction:'right'}},reverseFlowMultiplier:1,rainFocalLength:500,matrixCanvas:{width:800,height:600},matrixCtx:{clearRect(){clears++;}},document:{getElementById(){return null;}},performance,setTimeout,clearTimeout,console});
vm.runInContext(fs.readFileSync('vendor/canvas5/words.js','utf8'),context);context.Canvas5Words=window.Canvas5Words;
vm.runInContext(fs.readFileSync('rain-word-reading.js','utf8'),context);
const camera=vm.runInContext(fs.readFileSync('rain-camera.js','utf8').split("window.addEventListener('DOMContentLoaded'")[0]+';rainCamera;',context);camera.rotation=[1,0,0,0,1,0,0,0,1];camera.frame=10;
const rgb=Object.freeze([.1,.3,.8]);
for(let frame=0;frame<6;frame++)for(let id=0;id<2;id++)camera.marks.push({char:'ア',frame,streamId:id,x:frame*10,y:id*20,z:500,fontSize:10+id,alpha:.8,color:'#123456',rgb,trailLength:60+id,delta:[10,0,0]});
camera.pending.push(...camera.marks.slice(-2));const originalMarks=camera.marks.slice(),originalPending=camera.pending.slice(),before=camera.marks.map(({char,...rest})=>({...rest}));camera.bounds={center:[1,2,3]};const bounds=camera.bounds;
vm.runInContext(fs.readFileSync('rain-media-words.js','utf8'),context);
(async()=>{
 await window.rainMediaWords.activate();assert.equal(window.rainMediaWords.nextCharacter(0),null);assert.equal(clears,0,'Preparation preserves the existing picture');
 recognizer.onresult({resultIndex:0,results:[Object.assign([{transcript:'hello world'}],{isFinal:true})]});
 assert.equal(camera.marks.length,originalMarks.length,'First lyrics keep every trail glyph');assert.equal(camera.pending.length,originalPending.length);assert.equal(camera.bounds,bounds);assert.equal(camera.frame,10);assert.equal(clears,0,'First lyrics never clear the canvas');assert.equal(gpu.invalidate,true);
 for(let i=0;i<camera.marks.length;i++){const mark=camera.marks[i];assert.equal(mark,originalMarks[i]);const {char,...rest}=mark;assert.deepEqual(rest,before[i],'Positions, alpha, frozen birth RGB, sizes, ages and lifetimes survive the handoff');assert.ok(!/[\u30a0-\u30ff]/.test(char));assert.equal(mark.rgb,rgb);}
 assert.equal(camera.marks.filter(m=>m.streamId===0).map(m=>m.char).join(''),'hello ');assert.equal(camera.marks.filter(m=>m.streamId===1).map(m=>m.char).join(''),'world ');assert.equal(window.rainMediaWords.nextCharacter(0),'h','The live head continues its historical word cursor');
 const firstLetters=camera.marks.map(m=>m.char);gpu.invalidate=false;
 recognizer.onresult({resultIndex:0,results:[Object.assign([{transcript:'new lyrics now'}],{isFinal:true})]});assert.deepEqual(camera.marks.map(m=>m.char),firstLetters,'Later results never rewrite the whole field');assert.equal(gpu.invalidate,false);assert.equal(clears,0);
 window.rainMediaWords.pause();await window.rainMediaWords.resume();assert.deepEqual(camera.marks.map(m=>m.char),firstLetters,'Resuming recognition does not restart the handoff');window.rainMediaWords.deactivate();
 console.log('PASS no scene wipe, full trail and birth-color preservation, lyric-only handoff, continuous word cursors and no field rewrite on later words or resume.');
})().catch(error=>{console.error(error);process.exitCode=1;});
