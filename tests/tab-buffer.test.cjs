const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};vm.runInNewContext(fs.readFileSync('rain-tab-sync.js','utf8'),{window});
const buffer=new window.RainTabSync.FrameDelay();
for(let t=0;t<=6500;t+=20){const frame={width:320,height:180,pixels:new Uint8ClampedArray(320*180*4),time:t};const chosen=buffer.sample(frame,t,1900,true);if(t>2500){assert.ok(t-chosen.time>=1900);assert.ok(t-chosen.time<=1950);}assert.ok(buffer.bytes<=64*1024*1024);}
const now={width:320,height:180,pixels:new Uint8ClampedArray(320*180*4),time:6600};assert.equal(buffer.sample(now,6600,1900,false),now,'Disabling words restores the current picture');assert.equal(buffer.sample(now,6600,0,true),now);assert.equal(buffer.bytes,0);
console.log('PASS bounded shared-tab frame history, preserved delay and immediate live-picture recovery.');
