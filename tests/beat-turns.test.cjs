const assert=require('node:assert/strict'),fs=require('node:fs');
const Base=require('./load-runtime.cjs')('rain-audio-choreography.js'),Motion=require('./load-runtime.cjs')('beat-turns-policy.js');
const headings=['toward','down','left','away','up','right'],bins=[2,14,25,35,46,60];
function run(Type,feed,beat,seconds=20){
    const model=new Type();let direction='down';const out=[];
    for(let f=0;f<seconds*30;f++){
        const result=model.update(feed(f*1000/30),f*1000/30,direction,true,beat);
        direction=result.direction;out.push({...result});
    }
    return {model,out};
}
const hits=t=>{const s=new Float32Array(64).fill(.012);if(t%500<90)s[[2,25,60][Math.floor(t/500)%3]]=.4;return s;};
const oldOff=run(Base,hits,false),oldOn=run(Base,hits,true),off=run(Motion,hits,false),on=run(Motion,hits,true);
assert.deepEqual(on.out,oldOn.out,'Beat on preserves the accepted attack-driven choreography exactly');
const Legacy=require('./load-runtime.cjs')('rain-audio-motion.js');
assert.deepEqual(run(Motion.Original,hits,true).out,run(Legacy,hits,true).out);
assert.equal(run(Motion.Original,hits,false).model.turnCount,0,'The button has the same policy in Original motion too');
assert.ok(on.model.turnCount>=30);assert.equal(off.model.turnCount,0,'Short rhythmic hits do not steer with Beat turns off');
const speeds=off.out.slice(90).map(o=>o.speed);assert.ok(Math.max(...speeds)-Math.min(...speeds)>10,'Accents still propel rain with Beat turns off');
const sustained=t=>{const s=new Float32Array(64).fill(.012);s[bins[Math.floor(t/1000)%6]]=.4;return s;};
const holdOff=run(Motion,sustained,false),holdOn=run(Motion,sustained,true);
const legacyHoldOff=run(Motion.Original,sustained,false);
assert.deepEqual(new Set(legacyHoldOff.out.map(o=>o.direction)),new Set(headings),'Original motion must also preserve proposals between frames');
assert.deepEqual(new Set(holdOff.out.map(o=>o.direction)),new Set(headings),'Sustained content can still reach every direction');
assert.deepEqual(new Set(holdOn.out.map(o=>o.direction)),new Set(headings));
const still=t=>new Float32Array(64).fill(.12);assert.equal(run(Motion,still,false).model.turnCount,0);assert.equal(run(Motion,still,true).model.turnCount,0);
assert.deepEqual(run(Motion,hits,true).out,on.out,'No timer or random direction schedule');
// Switching the policy preserves active state and does not invent an attack.
const switched=new Motion();switched.update(sustained(0),0,'down',true,false);
const untouched=switched.anchor.slice();switched.update(sustained(33),33,'down',true,true);assert.deepEqual(switched.anchor,untouched);
const quiet=new Motion();quiet.update(hits(0),0,'down',true,false);quiet.update(hits(500),500,'down',true,false);assert.equal(quiet.turnCount,0,'No synthetic turn after an input gap');
const result={result:'PASS',oldShortHitTurns:{off:oldOff.model.turnCount,on:oldOn.model.turnCount},newShortHitTurns:{off:off.model.turnCount,on:on.model.turnCount},offSpeedRange:[Math.min(...speeds),Math.max(...speeds)],sustainedTurns:{off:holdOff.model.turnCount,on:holdOn.model.turnCount},acceptedBeatOnExactParity:true};
fs.writeFileSync(__dirname+'/beat-turns-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
