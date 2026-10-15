const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{},localStorage:{getItem(){return null;},setItem(){}}};
vm.runInNewContext(fs.readFileSync('rain-media-characters.js','utf8'),context);
const api=context.window.RainMediaCharacters,atlas=JSON.parse(fs.readFileSync('assets/media-characters.json'));
assert.equal(api.mode,'shading');
assert.equal(atlas.verifiedMasks,256);assert.equal(atlas.regeneratedFontMatchesEmbedded,true);
assert.equal(atlas.sourceBitsPerBrailleCell,8);assert.equal(atlas.circlesPerBit,4);
const bits=[1,8,2,16,4,32,64,128];
for(let mask=1;mask<255;mask++){
 const values=bits.map(bit=>(mask&bit)?192/255:64/255),copy=values.slice();
 assert.equal(api.brailleMask(values),mask,'Current source mask '+mask);
 assert.deepEqual(values,copy,'Source samples are read only');
 let previous=0;for(let amount=0;amount<=100;amount++){
  const next=api.brailleMask(values,amount);assert.equal(next&previous,previous,'Density only adds dots');previous=next;
 }
 assert.equal(previous,255);
}
for(let amount=0;amount<=100;amount++)assert.equal(api.brailleMask(Array(8).fill(4/255),amount),0);
for(const v of [20,64,128,200]){
 const stable=api.brailleMask(Array(8).fill(v/255));
 for(let phase=0;phase<8;phase++)assert.equal(api.brailleMask(Array.from({length:8},(_,i)=>(v+(i*3+phase)%9-4)/255)),stable);
}
assert.equal(api.brailleMask([.2,.8,.2,.8,.2,.8,.2,.8]),184);
assert.equal(api.brailleMask([.8,.2,.8,.2,.8,.2,.8,.2]),71);
for(let i=1;i<atlas.shades.length;i++)assert.ok(atlas.shades[i].ink>=atlas.shades[i-1].ink);
let previous=0;for(let v=0;v<=255;v++){const index=api.shadeIndex(v/255,atlas.shades.length);assert.ok(index>=previous);previous=index;}
assert.equal(previous,atlas.shades.length-1);
assert.doesNotMatch(atlas.shades.map(g=>g.char).join(''),/\p{L}/u,'Shading is the Canvas5 symbols-only picture ramp');
for(const [values,expected] of [
 [[0,0,0,0,0,0,1,1,1],0], // Horizontal contour.
 [[0,0,1,0,0,1,0,0,1],2], // Vertical contour.
 [[0,1,1,0,0,1,0,0,0],1],
 [[1,1,0,1,0,0,0,0,0],3]
]){assert.equal(api.edgeBucket(values),expected);assert.equal(api.edgeBucket(values.map(v=>1-v)),expected);}
assert.equal(api.edgeBucket(Array(9).fill(.5)),-1,'Flat shading does not manufacture edges');
api.setMode('lines');assert.equal(api.number(),3);api.setMode('shading');assert.equal(api.number(),1);
for(const aspect of [.3,.7,1,16/9,4])for(const quality of ['low','balanced','sharp']){
 api.setMode('shading');const [w,h]=api.samplingSize(aspect,quality);assert.ok(w*h<452000);assert.ok(w<=1024&&h<=961);
 api.setMode('original');const original=api.samplingSize(aspect,quality);assert.equal(original[0],Math.max(1,Math.round(Math.min(384,480*aspect))));
}
const gpu=fs.readFileSync('rain-camera-gpu.js','utf8');
assert.ok(gpu.includes('MAX_VERTEX_TEXTURE_IMAGE_UNITS'));assert.ok(gpu.includes("this.pictureVertexSampling?'':pictureSelection"));
assert.ok(gpu.includes('if(mediaLive&&mediaCharacters>0)'));
assert.ok(!api.selectionGLSL.includes('ageNow'),'No animation clock in image selection');
console.log('PASS Canvas5 glyph density, 256 masks/flat fields, current detail, monotonic controls, bounded sampling, and capability fallback.');
