const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const load=require('./load-runtime.cjs'),mix=load('rain-audio-characters.js');
const kana=/[\u30a0-\u30ff]/;mix.update([.4],{accent:true,region:2});
let count=0;for(let i=0;i<100000;i++)count+=kana.test(mix.choose(i%192));
assert.ok(Math.abs(count/100000-.55)<.005);mix.update([0]);
for(let i=0;i<10000;i++)assert.ok(kana.test(mix.choose(i%192)));
// Local media retains RGB and alpha, without a person worker or extra streams.
let image;const output={createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},putImageData(value){image=value;}};
const canvas={getContext(){return output;}},w={rainMedia:{options:{exposure:100,contrast:100}}};
vm.runInNewContext(fs.readFileSync('rain-media-assembly.js','utf8'),{window:w,document:{createElement(){return canvas;},getElementById(){return null;},hidden:false},matrixCanvas:{width:2,height:1},performance:{now(){return 0;}},Uint8Array,Uint8ClampedArray,Float32Array,Math,setTimeout,clearTimeout,Worker(){throw Error('Media depiction must not create a worker');}});
w.rainMediaAssembly.sample({kind:'image',source:{},width:2,height:1,pixels:new Uint8ClampedArray([255,255,255,255,0,0,0,255])});
assert.equal(image.data[0],255);assert.equal(image.data[4],0);
assert.equal(w.rainMediaAssembly.strengthAt(0,0),1);assert.equal(w.rainMediaAssembly.strengthAt(1,0),0);
for(const kind of ['image','video','tab']){
 w.rainMediaAssembly.sample({kind,source:{},width:2,height:1,pixels:new Uint8ClampedArray([31,181,242,255,210,42,97,0])});
 assert.deepEqual(Array.from(image.data),[31,181,242,255,210,42,97,0],'Full-frame RGB and transparent margins survive');
 assert.deepEqual({...w.rainMediaAssembly.colorAt(0,0)},{r:31,g:181,b:242,coverage:1});
 assert.equal(w.rainMediaAssembly.colorAt(1,0).coverage,0,'Borders retain normal rain');
 assert.equal(w.rainMediaAssembly.colorAt(2,0),null);
 assert.equal(w.rainMediaAssembly.strengthAt(1,0),0);
}
w.rainMedia.options.gamma=200;
w.rainMediaAssembly.sample({kind:'video',source:{},width:3,height:1,pixels:new Uint8ClampedArray([0,0,0,255,64,64,64,255,255,255,255,255])});
assert.deepEqual(Array.from(image.data),[0,0,0,255,128,128,128,255,255,255,255,255],'Gamma lifts shadows and preserves black and white');
w.rainMediaAssembly.reset();assert.equal(w.rainMediaAssembly.frame,null);
console.log('PASS 55/45 alphabet, full-frame image/video/tab RGB, transparent borders, gamma and source cleanup without extra glyphs.');
