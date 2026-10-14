const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};vm.runInNewContext(fs.readFileSync('rain-word-timeline.js','utf8'),{window});vm.runInNewContext(fs.readFileSync('rain-word-reading.js','utf8'),{window});
const timeline=new window.RainWordTimeline();timeline.add([{text:'one',timestamp:[0,.4]},{text:'two',timestamp:[.5,.9]},{text:'three',timestamp:[1,1.4]}],10,10,12);
assert.equal(timeline.at(9,3),'');assert.equal(timeline.at(10.2,3),'one');assert.equal(timeline.at(10.6,3),'one two');assert.equal(timeline.at(11.1,2),'two three');assert.equal(timeline.at(14,3),'one two three','Latest lyrics remain through silence');assert.equal(timeline.at(10.2,3),'one','Seeking reads the actual media clock');
timeline.add([{text:'replacement',timestamp:[.2,.7]}],10,10,12);assert.equal(timeline.at(10.6,3),'replacement','Overlapping analysis replaces its span without transcript duplication');
const reading=window.RainWordReading,letters=Array.from('HELLO WORLD');
for(const [dx,dy,vertical,want]of [[1,0,'down',1],[-1,0,'down',-1],[0,1,'down',1],[0,-1,'down',-1],[0,-1,'up',1],[0,1,'up',-1]]){
 const order=reading.order(dx,dy,vertical);assert.equal(order,want);const emitted=letters.map((_,i)=>reading.letter(letters,i,order));const spatial=order<0?emitted.reverse():emitted;assert.equal(spatial.join(''),'HELLO WORLD');
}
assert.equal(reading.order(0,0,'down',-1),-1,'Head-on depth motion retains its previous reading order');
console.log('PASS media-clock word reveal, seek, lyric retention, overlap replacement, spaces and readable left/right/vertical ordering.');

const realm=vm.createContext({window:{},MatrixRainEngine:{rainConfig:{direction:'left'}},reverseFlowMultiplier:1,rainFocalLength:500});
const camera=vm.runInContext(fs.readFileSync('rain-camera.js','utf8').split("window.addEventListener('DOMContentLoaded'")[0]+';rainCamera;',realm);
camera.enabled=false;assert.equal(reading.order(...Object.values(camera.wordFlow(0))),-1);
camera.enabled=true;camera.rotation=[-1,0,0,0,1,0,0,0,-1];assert.equal(reading.order(...Object.values(camera.wordFlow(0))),1,'A 180-degree camera yaw reverses projected horizontal travel and restores readable letter order');
