const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('matrix-rain-utility-suite.html','utf8');
const runtime=fs.readFileSync('rain-all-directions.js','utf8');
const opposite={down:'up',up:'down',left:'right',right:'left',toward:'away',away:'toward'};
function setup(mode='counterflow',beat=false,reverse=1){
    const ctx=vm.createContext({window:{columnOrder:Array.from({length:80},(_,i)=>i),audioReactiveActive:true},
        MatrixRainEngine:{rainConfig:{direction:'down',fontSize:10,density:40}},audioReverseEnabled:beat,
        matrixCanvas:{width:800,height:600},matrixDrops:Array(80).fill(20),
        matrixCtx:{globalAlpha:1,fillStyle:'#00ff41',fillText(){}},
        rainCameraGPU:{failed:false,lost:false,invalidate:false},reverseFlowMultiplier:reverse,performance,console});
    vm.runInContext(runtime,ctx);
    vm.runInContext(html.slice(html.indexOf('        const rainMotion ='),html.indexOf('        function drawMatrixRain()')),ctx);
    vm.runInContext([...html.matchAll(/^        function recomputeActiveColumnsMask\(\) \{[\s\S]*?^        \}/gm)].at(-1)[0],ctx);
    vm.runInContext(fs.readFileSync('rain-camera.js','utf8').split("window.addEventListener('DOMContentLoaded'")[0],ctx);
    vm.runInContext(`globalThis.camera=rainCamera;globalThis.motion=rainMotion;
        globalThis.tick=(speed=.85)=>{prepareRainMotion(10);for(let i=0;i<32;i++){
            const p=rainPosition(i,10);paintRainCharacter('カ',p.x,p.y,i,10);advanceRainPosition(i,10,speed);
        }rainCamera.frame++;};
        for(let i=0;i<80;i++){const p=rainPosition(i,10);p.depth=100+(i%4)*125;p.x=100+(i%16)*40;p.y=200+(i%3)*30;}`,ctx);
    ctx.window.rainAllDirections.setMode(mode);
    return ctx;
}
const heads=ctx=>Array.from({length:32},(_,i)=>ctx.motion.drops[i].lastStepDirection);
const wanted=ctx=>Array.from({length:32},(_,i)=>ctx.window.rainAllDirections.directionFor(i,true)||ctx.MatrixRainEngine.rainConfig.direction);

// The latest safe perpendicular beat turn must reach real native heads on the
// very next glyph step, even after a previous reversal started long detours.
for(const beat of [false,true]){
    const ctx=setup('counterflow',beat),flow=ctx.window.rainAllDirections;
    for(let f=0;f<20;f++)ctx.tick();
    ctx.MatrixRainEngine.rainConfig.direction='up';ctx.tick();
    const before=heads(ctx);
    ctx.MatrixRainEngine.rainConfig.direction='right';const target=wanted(ctx);ctx.tick();
    const after=heads(ctx),safe=before.map((heading,i)=>heading!==opposite[target[i]]);
    const safeCount=safe.filter(Boolean).length;
    const matched=after.filter((heading,i)=>safe[i]&&heading===target[i]).length;
    if(beat)assert.equal(matched,safeCount,'Beat turns takes every safe new heading on the next native step');
    else assert.ok(matched<safeCount,'Beat turns off preserves the original six-glyph detours');
    for(let i=0;i<after.length;i++)assert.notEqual(after[i],opposite[before[i]],'Reversals use a native perpendicular segment');
    assert.ok([...flow.records.values()].every(record=>Number.isFinite(record.hold)));
}

// A fresh musical turn supersedes organic Auto stagger and its original
// destination. Births, history, colors and velocity remain native.
for(const mode of ['directed','counterflow','crossflow']){
    const ctx=setup('directed',true),flow=ctx.window.rainAllDirections;
    for(let f=0;f<4;f++)ctx.tick();
    const history=ctx.camera.marks.map(mark=>[mark.x,mark.y,mark.z,mark.char,mark.color]);
    flow.applyMode(mode==='directed'?'counterflow':mode,true);
    if(mode==='directed'){
        for(let f=0;f<20;f++)ctx.tick();
        flow.applyMode('directed',true);
    }
    const before=heads(ctx);
    ctx.MatrixRainEngine.rainConfig.direction='right';const target=wanted(ctx);ctx.tick();
    const after=heads(ctx);
    for(let i=0;i<32;i++){
        if(before[i]!==opposite[target[i]])assert.equal(after[i],target[i],mode+': beat supersedes the organic target');
        assert.equal(flow.records.get(i).delay,0,mode+': beat supersedes old stream stagger');
    }
    for(let f=0;f<40;f++)ctx.tick();
    assert.equal(flow.transitioning,false,mode+': native handoff reaches the latest heading');
    assert.deepEqual(ctx.camera.marks.slice(0,history.length).map(mark=>[mark.x,mark.y,mark.z,mark.char,mark.color]),history);
}

// Same-heading accents must not continually restart or shorten a reversal.
{
    const ctx=setup('counterflow',true),flow=ctx.window.rainAllDirections;
    ctx.tick();ctx.MatrixRainEngine.rainConfig.direction='up';ctx.tick();
    const held=flow.records.get(0).hold;
    assert.ok(held>0);
    ctx.tick();assert.ok(Math.abs(flow.records.get(0).hold-(held-8.5))<1e-8,'Unchanged conductor continues its native segment');
}

// Exercise the actual production advance/capture functions with rapidly
// changing headings. No warping, diagonal steps or backwards trail folding.
for(const reverse of [1,-1]){
    const ctx=setup('counterflow',true,reverse),flow=ctx.window.rainAllDirections;
    const formationJoints=new Map(),nativePlan=flow.planStep;
    flow.planStep=function(index,depth,fontSize,speed){
        const record=this.records.get(index),previous=record?.last;
        const formation=record?.transition&&record?.formationReverse&&record.conductor===ctx.MatrixRainEngine.rainConfig.direction;
        const route=nativePlan.call(this,index,depth,fontSize,speed);
        // The next capture records this exact native step. Only a deliberate
        // formation reversal may bypass the ordinary steering corner rule.
        if(formation&&route?.direction===opposite[previous])formationJoints.set(index,ctx.camera.frame+1);
        return route;
    };
    const previous=new Map();ctx.tick(1.3);
    const history=ctx.camera.marks.map(mark=>[mark.x,mark.y,mark.z,mark.char,mark.color]);
    const directions=['down','right','away','up','left','toward'];
    for(let frame=0;frame<240;frame++){
        if(frame%6===0)ctx.MatrixRainEngine.rainConfig.direction=directions[Math.floor(frame/6)%directions.length];
        if(frame===40)flow.applyMode('directed',true);
        if(frame===100)flow.applyMode('counterflow',true);
        ctx.tick(1.3);
        for(const mark of ctx.camera.marks.slice(-32)){
            assert.ok(mark.delta.filter(value=>Math.abs(value)>1e-5).length<=1,'Each native step stays on one world axis');
            const length=Math.hypot(...mark.delta);
            assert.ok(Number.isFinite(length)&&length<=13.00001,'No native head is accelerated');
            if(length<1e-5)continue;
            const vector=mark.delta.map(value=>value/length),before=previous.get(mark.streamId);
            // Steady Single direction retains its original controller behavior;
            // only exact Single/Counterflow formation joints may reverse directly.
            if(before&&(flow.mode==='counterflow'||flow.transitioning)){
                const dot=vector.reduce((sum,value,i)=>sum+value*before[i],0);
                assert.ok(dot>-.001||formationJoints.get(mark.streamId)===mark.frame,'Only the deliberate formation joint may reverse in the native flow router');
            }
            previous.set(mark.streamId,vector);
        }
    }
    assert.deepEqual(ctx.camera.marks.slice(0,history.length).map(mark=>[mark.x,mark.y,mark.z,mark.char,mark.color]),history);
}
console.log('PASS Beat turns reaches actual native heads, supersedes stale organic handoffs, preserves Beat-off detours and same-heading accents, with bounded XYZ steps and immutable history.');
