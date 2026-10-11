import assert from 'node:assert/strict';
import {RainTrailLengths} from '../trails/rain-trail-lengths.js';
const trails = new RainTrailLengths();
const lengths = Array.from({length:192},(_,id)=>trails.lengthFor(id));
assert.equal(trails.minimum,12);
assert.equal(trails.maximum,100);
assert.ok(lengths.every(length=>length>=12&&length<=100));
assert.ok(new Set(lengths).size>40,'Drops have visibly different lengths');
assert.deepEqual(lengths, lengths.map((_,id)=>trails.lengthFor(id)), 'Repeated frames never reroll a drop');
for(const length of lengths) {
    assert.equal(trails.alpha(length,0),1,'The head stays fully bright');
    assert.equal(trails.alpha(length,length),0,'The tail ends smoothly at black');
    if (length>=48) assert.ok(trails.alpha(length,20)>Math.pow(.88,20),'Longer drops stay visible farther behind the head');
}
assert.ok(trails.alpha(96,40)>trails.alpha(32,40),'Longer drops retain more of the trail');
trails.configure(80,20);
assert.equal(trails.minimum,80);assert.equal(trails.maximum,80,'Bounds cannot cross');
trails.configure(12,160);
assert.ok(Array.from({length:192},(_,id)=>trails.lengthFor(id)).every(length=>length>=12&&length<=160));
trails.enabled=false;
assert.equal(trails.lengthFor(0),40);
assert.equal(trails.alpha(40,20),Math.pow(.88,20),'Disabling variation restores the original fade');
console.log('Stable variable trail lengths, bounded controls, gradual fade, and original fade fallback passed.');
