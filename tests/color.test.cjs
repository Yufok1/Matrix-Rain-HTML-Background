const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Color=require('./load-runtime.cjs')('rain-audio-color.js'),arc=(a,b)=>((a-b+540)%360+360)%360-180;
const options={source:'wallpaper',preset:'zen',sensitivity:500,hueScale:.6,satFloor:45,satGain:.6,brightnessMin:52,brightnessMax:80,brightnessDepth:.8};
const spectrum=(bin,value=.25)=>{const s=new Float32Array(64);s[bin]=value;return s;};
const results=[];
function feed(model,bin,from,to,opts=options){let output;for(let t=from;t<to;t+=1000/30)output=model.update(spectrum(bin),t,opts);return output;}
const steady=new Color();feed(steady,24,0,5000);const settled=steady.snapshot.hue;
feed(steady,24,5000,15000);assert.ok(Math.abs(arc(steady.snapshot.hue,settled))<1e-6);results.push({heldMidrange:'no hue cycling'});
const accents=new Color();feed(accents,24,0,5000);const held=accents.snapshot.hue;
for(let t=5000;t<15000;t+=1000/30){const s=spectrum(24);s[2]=t%500<130?.9:0;s[58]=t%310<80?.8:0;accents.update(s,t,options);}
assert.ok(Math.abs(arc(accents.snapshot.hue,held))<1e-6);results.push({bassAndTrebleAccents:'held midrange hue unchanged'});
const contour=new Color();feed(contour,24,0,2000);const initial=contour.snapshot.hue;
feed(contour,30,2000,4000);const shifted=contour.snapshot.hue;
assert.ok(Math.abs(arc(shifted,initial))>10,'Changing midrange shape at equal loudness changes hue');
assert.equal([...spectrum(24)].slice(20,40).reduce((a,b)=>a+b),[...spectrum(30)].slice(20,40).reduce((a,b)=>a+b),'Legacy broad-band average is unchanged');
results.push({equalLoudnessContourShiftDegrees:+arc(shifted,initial).toFixed(2)});
const gain100=new Color(),gain500=new Color();
feed(gain100,24,0,5000,{...options,sensitivity:100});feed(gain500,24,0,5000);
const anchorHue=gain100.snapshot.hue;
assert.ok(Math.abs(arc(anchorHue,gain500.snapshot.hue))<1e-7,'Sensitivity does not pin a held sound to a different palette endpoint');
feed(gain100,26,5000,5300,{...options,sensitivity:100});feed(gain500,26,5000,5300);
assert.ok(Math.abs(arc(gain500.snapshot.hue,anchorHue))>Math.abs(arc(gain100.snapshot.hue,anchorHue))*2);
results.push({sensitivity:'larger recent fluctuations; unchanged sustained tonal destination'});
for(const preset of ['zen','prism'])for(const source of ['wallpaper','browser'])for(const bias of [.05,.25,.5,.75,.9]){
    const begin=source==='wallpaper'?8:21,end=source==='wallpaper'?40:50,b=begin+Math.floor((end-begin-3)*bias);
    const a=new Color(),c=new Color(),ranges=[[],[]];
    for(let f=0;f<700;f++){
        const s=new Float32Array(64),v=.025*Math.sin(f*.18);s[b]=.25+v;s[b+2]=.25-v;
        a.update(s,f*33,{...options,preset,source,hueScale:1,sensitivity:100});
        c.update(s,f*33,{...options,preset,source,hueScale:1,sensitivity:500});
        if(f>300){ranges[0].push(a.unwrappedHue);ranges[1].push(c.unwrappedHue);}
    }
    const span=ranges.map(r=>Math.max(...r)-Math.min(...r));
    assert.ok(span[1]>span[0]*2,`${preset}/${source}/${bias}: 500% must increase small fluctuations, including biased spectra`);
}
results.push({biasedSpectrumSensitivity:'500% increases visible small fluctuations across twenty palette/source/position cases'});
for(const preset of ['zen','prism'])for(const source of ['wallpaper','browser']){
    const c=new Color(),opts={...options,preset,source,hueScale:1};let last;
    const begin=source==='wallpaper'?8:21,end=source==='wallpaper'?40:50;
    for(let f=0;f<1800;f++){
        const b=begin+Math.floor(f/60)%(end-begin),output=c.update(spectrum(b),f*1000/30,opts);
        if(last!==undefined)assert.ok(Math.abs(arc(output.hue,last))<=9.601,'Hue rate is bounded even at 500%');last=output.hue;
        assert.ok(Math.abs(arc(output.hue,output.baseHue))<=output.halfSpan+.001,'Palette follows the chosen absolute range');
        for(const v of [...output.colorA,...output.colorB])assert.ok(Number.isFinite(v)&&v>=0&&v<=1);
    }
    const silenceHue=c.snapshot.hue;
    for(let f=0;f<120;f++)c.update(new Float32Array(64),61000+f*1000/30,opts);
    assert.equal(c.snapshot.hue,silenceHue,'Silence holds hue immediately');
    results.push({preset,source,halfSpan:c.snapshot.halfSpan,maxDegreesPerSecond:288});
}
const louder=new Color();feed(louder,24,0,5000);
const loudnessHue=louder.snapshot.hue;
for(let t=5000;t<9000;t+=1000/30)louder.update(spectrum(24,t%400<200?.05:.5),t,options);
assert.ok(Math.abs(arc(louder.snapshot.hue,loudnessHue))<1e-3,'Volume alone does not act as pitch');
results.push({loudness:'hue stable for unchanged spectral shape'});
// Repeat an irregular clip at a completely different wall-clock offset.
const Motion=require('./load-runtime.cjs')('rain-audio-choreography.js');
function replay(offset){
    const c=new Color(),m=new Motion();let heading='down';const out=[];
    for(let f=0;f<900;f++){
        const s=new Float32Array(64).fill(.005);
        s[2]=f%17<4?.3:.02;s[58]=f%11<2?.15:.01;
        s[[16,24,28,34,22,30][Math.floor(f/23)%6]]=.25;
        const movement=m.update(s,offset+f*33,heading,true,false);heading=movement.direction;
        const color=c.update(s,offset+f*33,options);
        out.push([heading,movement.speed,color.hue,color.saturation,color.lightness]);
    }
    return out;
}
assert.deepEqual(replay(0),replay(900000),'Same input/settings/starting state repeats despite a different clock time');
const earlierA=new Color(),earlierB=new Color();feed(earlierA,10,0,4000);feed(earlierB,38,0,4000);
feed(earlierA,25,4000,14000);feed(earlierB,25,4000,14000);
assert.ok(Math.abs(arc(earlierA.snapshot.hue,earlierB.snapshot.hue))<1e-3,'The same tone has the same destination after different earlier passages');
results.push({replay:'900 frames of motion and color identical at a different absolute time; earlier hues do not change the tonal destination'});
const noMiddle=new Color();for(let f=0;f<120;f++){const s=new Float32Array(64);s[2]=.8;s[59]=.8;noMiddle.update(s,f*33,options);}assert.equal(noMiddle.ready,false);
for(const bad of [Array(64).fill(NaN),Array(64).fill(-1),Array(64).fill(Infinity)]){const out=noMiddle.update(bad,4100,options);assert.ok(Number.isFinite(out.hue));}
// Birth RGB is retained in the original 22-float record, with eight attributes.
const gpuSource=fs.readFileSync(path.join(__dirname,'..','rain-camera-gpu.js'),'utf8');
const gpu=vm.runInNewContext(gpuSource+';rainCameraGPU;');
gpu.staging=new Float32Array(44);gpu.glyph=()=>({uv:[0,0,1,1],shape:[0,-1,1,.5],mode:1});gpu.color=()=>[.5,.2,.8];
const mark={char:'A',x:12,y:34,z:500,fontSize:24,color:'#aa22ff',rgb:Object.freeze([.2,.3,.4]),alpha:.8,frame:10,trailLength:100,delta:[1,2,3],streamId:21};
gpu.pack(mark,0);gpu.pack({...mark,char:'B',x:18,frame:16,color:'#00ff22'},1);
assert.equal(gpu.stride,22);assert.deepEqual(Array.from(gpu.staging.slice(4,7)),Array.from(gpu.staging.slice(26,29)),'Birth color survives later CSS and age changes');
assert.deepEqual(Array.from(gpu.staging.slice(18,21)),[1,2,3]);assert.equal(gpu.staging[17],100);assert.equal(gpu.staging[21],1);
assert.match(gpuSource,/\[6,3,18\],\[7,1,21\]/);assert.doesNotMatch(gpuSource,/sharedPalette|paletteA|paletteB/);
const reference=gpuSource;
assert.equal(gpuSource.match(/float level\(float p\)\{[^\n]+/)[0],reference.match(/float level\(float p\)\{[^\n]+/)[0]);
for(const preset of ['zen','prism','pastel','hyperneon','aurora']) {
    const dark=new Color();for(let f=0;f<240;f++){
        const out=dark.update(spectrum(25,(f%30)/30),f*33,{...options,preset,brightnessMin:52,brightnessMax:100});
        assert.ok(out.lightness<=48);for(const c of [out.colorA,out.colorB])assert.ok(Math.min(...c)<.25,'No pale white floor in the glyph RGB');
    }
}
results.push({GPU:'immutable birth RGB; no live palette shader; original 22-float record; fade and eight attributes preserved',colors:'dark output even with light preset bounds'});
fs.writeFileSync(path.join(__dirname,'color-test-results.json'),JSON.stringify({result:'PASS',kind:'synthetic spectra and actual GPU packing, not real vocal separation',results},null,2)+'\n');
console.log(JSON.stringify({result:'PASS',checks:results.length,results}));
