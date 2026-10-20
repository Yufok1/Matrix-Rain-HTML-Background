const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync(name,'utf8'),html=read('matrix-rain-utility-suite.html'),load=require('./load-runtime.cjs');
function source(name){
    const matches=html.match(new RegExp('^        (?:async )?function '+name+'\\([^\\n]*\\) \\{[\\s\\S]*?^        \\}','gm'));
    assert.ok(matches?.length,name);return matches.at(-1);
}
function fixture(seed=6241){
    let now=0,nextNativeStep=0,moves=0;
    const elements=new Map(),storage=new Map([['matrixRain.flow','crossflow']]);
    const element=id=>{
        if(!elements.has(id))elements.set(id,{value:'',style:{},dataset:{},checked:false,textContent:'',
            classList:{add(){},remove(){}},setAttribute(){},querySelectorAll(){return[];}});
        return elements.get(id);
    };
    const context=vm.createContext({window:{addEventListener(){},matrixRainRendering:{quality:'balanced',sharp:true,smooth:true,glow:0,contrast:1},
        audioReactiveActive:true,columnOrder:Array.from({length:80},(_,i)=>i),rainAudioPalette:{active:false},rainColorMode:'cohesive'},
        document:{getElementById:element,querySelector:()=>element('pattern'),querySelectorAll:()=>[]},
        localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},
        Math:Object.assign(Object.create(Math),{random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}}),
        performance:{now:()=>now},console,matrixCanvas:{width:800,height:600,style:{}},matrixDrops:Array(80).fill(20),
        matrixCtx:{save(){},restore(){},clearRect(){},fillText(){},globalAlpha:1,fillStyle:'#00ff41'},
        rainCameraGPU:{failed:false,lost:false,invalidate:false,render(camera){camera.pending.length=0;},hide(){}},reverseFlowMultiplier:1,
        MatrixRainEngine:{rainConfig:{direction:'away',speed:35,intensity:70,density:50,fontSize:16,pattern:'classic',
            characterSet:'katakana',primaryColor:'#00ff41',secondaryColor:'#00cc33'},logActivity(){}},
        autoOrchestratorActive:true,audioReactiveActive:true,audioReverseEnabled:true,colorFluctuationPercent:100,
        audioColorPreset:'zen',hueReactivityScale:.6,satGainScale:.6,brightnessDepthScale:.8,audioHueSpread:.8,audioHighModRange:16,
        satFloor:45,brightnessMin:52,brightnessMax:80,RainAudioMotion:load('rain-audio-motion.js'),
        RainAudioColor:load('rain-audio-color.js'),RainChoreographyComparison:load('beat-turns-policy.js')});
    vm.runInContext(read('rain-camera-motion.js'),context);
    vm.runInContext(read('rain-camera.js').split("window.addEventListener('DOMContentLoaded'")[0],context);
    vm.runInContext(html.slice(html.indexOf('        const rainMotion ='),html.indexOf('        function drawMatrixRain()')),context);
    vm.runInContext(source('recomputeActiveColumnsMask'),context);
    vm.runInContext(read('rain-all-directions.js'),context);
    vm.runInContext(read('rain-auto-scenes.js'),context);
    vm.runInContext(read('rain-color-fluctuation.js'),context);
    context.window.rainMelodyColor=new context.RainAudioColor();
    context.audioColorFluctuation=new context.window.RainColorFluctuation();
    context.window.matrixRainTrails={enabled:false,stepped:true,minimum:12,maximum:100,revision:0,
        lengthFor(){return 40;},configure(min,max){this.minimum=min;this.maximum=max;this.revision++;}};
    const start=html.indexOf('        const audioMotion ='),end=html.indexOf('        function drawAudioVisualizer(',start);
    vm.runInContext(source('hslToHex')+'\n'+html.slice(start,end)+`\n
        globalThis.camera=rainCamera;globalThis.motion=rainMotion;
        globalThis.feed=spectrum=>{audioMotionSpectrum=spectrum;reactToAudio(80,70,65,40,.25,true);};
        globalThis.stepNative=()=>{
            const size=Number(MatrixRainEngine.rainConfig.fontSize);prepareRainMotion(size);
            for(let i=0;i<80;i++)if(window.activeColumnsMask[i]){
                const p=rainPosition(i,size);paintRainCharacter('カ',p.x,p.y,i,size);advanceRainPosition(i,size,.85);
            }
            rainCamera.advanceFrame();
        };
        recomputeActiveColumnsMask();rainCamera.beginContinuousView();
        for(let i=0;i<80;i++){
            const p=rainPosition(i,16);p.depth=100+(i%6)*125;p.x=80+(i%16)*40;p.y=120+(i%8)*40;
        }
    `,context);
    const {camera,motion}=context,scenes=context.window.rainAutoScenes,flow=context.window.rainAllDirections,c=context.MatrixRainEngine.rainConfig;
    const born=new WeakMap();
    const musical=()=>JSON.stringify([c.direction,c.speed,c.intensity,c.primaryColor,c.secondaryColor,c.pattern,c.characterSet,context.reverseFlowMultiplier]);
    function tick(frame,decide){
        now=frame*1000/30;
        const spectrum=new Float32Array(64).fill(.012);
        spectrum[[2,14,25,35,46,60][Math.floor(frame/6)%6]]=.4;
        context.feed(spectrum);const output=musical();
        decide?.(frame);camera.present(now);
        assert.equal(musical(),output,'Spatial routing does not directly overwrite actual audio output');
        if(now+1e-6>=nextNativeStep){
            context.stepNative();moves++;nextNativeStep=now+Number(c.speed);
            // Sample history once per second, preserving evidence across
            // handoffs without turning rendering QA into a CPU stress test.
            for(let index=0;frame%30===0&&index<camera.marks.length;index+=1){
                const mark=camera.marks[index];
                const state=JSON.stringify([mark.x,mark.y,mark.z,mark.fontSize,mark.color,mark.char,mark.delta]);
                if(!born.has(mark))born.set(mark,state);
                else assert.equal(state,born.get(mark),'Native birth history remains exact during all procedural handoffs');
            }
        }
        return frame+1;
    }
    function until(frame,predicate,seconds,decide){
        const deadline=frame+Math.ceil(seconds*30);
        while(frame<deadline&&!predicate())frame=tick(frame,decide);
        assert.ok(predicate(),`Route did not complete in ${seconds}s: ${JSON.stringify({mode:flow.mode,transitioning:flow.transitioning,
            description:scenes.description,queue:scenes.queue,preparing:scenes.preparingFlat,camera:camera.enabled,perspective:camera.perspective,
            directions:[...new Set(motion.drops.filter(Boolean).map(p=>p.lastStepDirection))]})}`);
        return frame;
    }
    return{context,camera,motion,scenes,flow,c,tick,until,moves:()=>moves};
}

// Begin in the user's failure state. Feed real audio, move real rain heads, and
// require every requested organic flow handoff to finish despite rapid new turns.
{
    const h=fixture(),{flow,scenes,camera,motion}=h;let frame=0;
    for(;frame<60;frame=h.tick(frame));
    for(const target of ['counterflow','directed','crossflow','directed']){
        assert.equal(scenes.apply({kind:'flow',value:target}),true,'Combined Auto may own spatial flow');
        frame=h.until(frame,()=>flow.mode===target&&!flow.transitioning,15);
    }
    // Request the actual procedural depth family from a fully spatial field.
    scenes.reset();assert.equal(scenes.next('depth'),true);
    assert.equal(scenes.preparingFlat,true);
    let sawQueuedClose=false,sawWaiting=false;
    frame=h.until(frame,()=>!camera.enabled&&camera.perspective===0&&!camera.depthTransition,25,frame=>{
        if(scenes.queue.some(step=>step.kind==='depth'&&step.value===false))sawQueuedClose=true;
        if(frame%8===0){const pending=scenes.queue[0];const result=scenes.next();
            if(result===false&&pending?.kind==='depth'&&pending.value===false){sawWaiting=true;assert.equal(scenes.queue[0],pending,'Deferred close remains queued while actual heads finish');}}
    });
    assert.ok(sawQueuedClose,'Real route retains an explicit close step');
    assert.equal(flow.mode,'directed');assert.equal(scenes.preparingFlat,false);
    assert.ok(motion.drops.every((head,index)=>!h.context.window.activeColumnsMask[index]||!['toward','away'].includes(head.lastStepDirection)),'Active heads finish actual planar movement before the flat endpoint');
    assert.equal(scenes.next('depth'),true,'The same world can open again');
    frame=h.until(frame,()=>camera.enabled&&camera.perspective===1&&!camera.depthTransition,12,frame=>{if(frame%8===0)scenes.next();});
    assert.ok(h.moves()>120,'Progress comes from actual native steps, not a settle-only fixture');
    console.log(`PASS real audio/native-head handoffs, Crossflow escape, deferred planar close and reopen (${h.moves()} native frames; close waited=${sawWaiting}).`);
}

// Autonomous coverage must produce major, visible changes repeatedly rather
// than spend the entire session applying tiny render/tail adjustments.
{
    const h=fixture(9113),{scenes,flow,camera,c}=h;
    const families=new Set(),flows=new Set(),depths=new Set(),sizes=new Set(),densities=new Set();
    for(let frame=0;frame<3600;frame++){
        h.tick(frame,()=>{if(frame%8===0&&scenes.next())families.add(scenes.last);});
        if(!flow.transitioning)flows.add(flow.mode);
        if(!camera.depthTransition)depths.add(camera.perspective);
        sizes.add(c.fontSize);densities.add(c.density);
    }
    for(const family of ['camera','depth','flow','size','density'])assert.ok(families.has(family),'The major-family bag reaches '+family);
    assert.deepEqual(new Set(flows),new Set(['directed','counterflow','crossflow']),'A real autonomous session reaches and settles all flow patterns');
    assert.ok(depths.has(0)&&depths.has(1),'A real autonomous session completes both flat and spatial endpoints');
    assert.ok(Math.max(...sizes)-Math.min(...sizes)>=2,'Bounded font changes still vary within the new middle range');
    assert.ok(Math.max(...sizes)<=20,'Auto does not trade performance for oversized glyphs');
    assert.ok(Math.min(...sizes)>=14,'Combined Auto never chooses tiny glyphs');
    assert.ok(Math.max(...densities)-Math.min(...densities)>=25,'Density changes have meaningful visible range');
    assert.equal(h.context.reverseFlowMultiplier,1,'Global reverse remains manual');
    console.log(`PASS two-minute real combined progression: families=${[...families]}, flows=${[...flows]}, native frames=${h.moves()}.`);
}
