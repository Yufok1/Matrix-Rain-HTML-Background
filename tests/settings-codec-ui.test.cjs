const assert=require('node:assert/strict'),codec=require('./load-runtime.cjs')('rain-settings-codec.js');
const legacyWords={maxWords:3,bufferMs:1900,verticalOrder:'down'};
const fixture={v:15,auto:{interval:12},name:'Zen 雨 🎵',
    rain:{pattern:'classic',speed:35,intensity:70,density:50,fontSize:10,primary:'#00ff41',secondary:'#00cc33',characterSet:'custom',customCharacters:'雨∑M123🪐',direction:'down',reverse:false,flow:'directed'},
    audio:{preset:'zen',beatTurns:false,fluctuation:500,hueReact:60,saturationGain:60,brightnessDepth:80,spread:.8,trebleHueRange:16,saturationFloor:45,brightnessMin:52,brightnessMax:80},
    camera:{enabled:true,continuous:false,mode:'gyroscope',yaw:15.25,pitch:20,roll:-10,speeds:{showcase:25,corkscrew:30,gyroscope:20}},
    render:{quality:'sharp',sharp:true,smooth:true,glow:15,contrast:100},
    trails:{enabled:true,stepped:true,minimum:12,maximum:100},media:{influence:100,exposure:100,contrast:100,gamma:100,characters:'original',dotDensity:50}};
const blob=codec.encode(fixture);assert.match(blob,/^MR15\.[A-Za-z0-9_-]+$/);assert.deepEqual(codec.decode(blob),fixture);
assert.equal(codec.encode(codec.decode(blob)),blob);assert.deepEqual(codec.decode(blob.slice(0,40)+'\n'+blob.slice(40)),fixture);
const oneSecond=structuredClone(fixture);oneSecond.auto.interval=1;
assert.deepEqual(codec.decode(codec.encode(oneSecond)),oneSecond,'One-second timing survives export/import');
for(const interval of [0,.5,1.5,61])assert.throws(()=>codec.validate({...fixture,auto:{interval}}),'Timing remains whole seconds from one to sixty');
assert.match(require('node:fs').readFileSync('rain-settings-ui.js','utf8'),/id="autoSceneInterval" type="range" min="1" max="60" step="1"/);
const raw=x=>'MR'+x.v+'.'+Buffer.from(JSON.stringify(x)).toString('base64url');
const fail=edit=>{const x=structuredClone(fixture);edit(x);assert.throws(()=>codec.decode(raw(x)));};
fail(x=>x.v=16);fail(x=>x.rain.flow='random');fail(x=>x.media.characters='pixels');fail(x=>x.media.dotDensity=101);fail(x=>x.media.dotDensity=2.5);fail(x=>x.rain.fontSize=101);fail(x=>x.camera.speeds.gyroscope=-1);fail(x=>x.render.glow='15');
fail(x=>x.rain.fontSize=23.2);fail(x=>x.trails.minimum=120);fail(x=>x.audio.brightnessMin=99);fail(x=>x.rain.characterSet='particles');
fail(x=>x.rain.primary='<script>');fail(x=>x.rain.customCharacters='x'.repeat(513));fail(x=>x.name='x'.repeat(61));
fail(x=>x.rain.customCharacters=' ');fail(x=>{x.camera.enabled=false;x.rain.direction='toward';});
fail(x=>x.preview={motion:'original',color:'original'});fail(x=>x.audio.mediaAccess=true);fail(x=>x.audio.depth=true);
const paths=codec.paths();
for(const follow of [false,true]){
 const legacy=structuredClone(fixture);delete legacy.camera.continuous;delete legacy.auto;legacy.v=13;legacy.audio.flowFollow=follow;
 assert.deepEqual(codec.decode(raw(legacy)),fixture,'MR13 preserves visuals and retires automatic flow');
 legacy.audio.flowFollow='true';assert.throws(()=>codec.decode(raw(legacy)),'Validate retired flags before discarding them');
}
fail(x=>x.audio.flowFollow=true);
assert.ok(!paths.includes('audio.flowFollow'));

fail(x=>x.words={...legacyWords}); // Removed controls cannot enter new exports.
const tuned=structuredClone(fixture);tuned.rain.flow='crossflow';tuned.media={influence:62,exposure:142,contrast:176,gamma:220,characters:'braille',dotDensity:81};
 tuned.camera.continuous=true;tuned.camera.enabled=false;tuned.camera.roll=43;tuned.auto.interval=7;
assert.deepEqual(codec.decode(codec.encode(tuned)),tuned,'all new visual controls round trip');
for(const p of paths){const x=structuredClone(fixture),keys=p.split('.'),leaf=keys.pop();let parent=x;for(const k of keys)parent=parent[k];delete parent[leaf];assert.throws(()=>codec.validate(x),p);}
const previous=structuredClone(fixture);previous.v=14;delete previous.camera.continuous;delete previous.auto;assert.deepEqual(codec.decode(raw(previous)),fixture);
const old=structuredClone(fixture);delete old.camera.continuous;delete old.auto;delete old.audio.flowFollow;delete old.rain.flow;delete old.media.characters;delete old.media.dotDensity;old.v=10;
assert.deepEqual(codec.decode(raw(old)),fixture,'MR10 retains its original single-direction character presentation');
const legacy2={...structuredClone(old),v:2,preview:{motion:'original',color:'original'}};delete legacy2.media;delete legacy2.words;
const legacy3={...structuredClone(old),v:3};delete legacy3.media;delete legacy3.words;
const oldMedia={influence:100,exposure:100,contrast:100,mirror:false};
const legacy4={...structuredClone(old),v:4,media:{...oldMedia,glints:true}};
const legacy5={...structuredClone(old),v:5,media:oldMedia};
delete legacy4.words;delete legacy5.words;
const legacy9={...structuredClone(old),v:9,words:{...legacyWords}};
assert.deepEqual(codec.decode(raw(legacy9)),fixture,'MR9 retains visuals and discards removed speech preferences');
legacy9.words.maxWords=6;assert.throws(()=>codec.decode(raw(legacy9)),'Validate legacy preferences before discarding them');
const legacy8={...structuredClone(old),v:8,words:{...legacyWords},media:{...old.media,mirror:true,isolate:false}};
assert.deepEqual(codec.decode(raw(legacy8)),fixture,'MR8 removes webcam-only fields without changing other preferences');
legacy8.media.mirror='true';assert.throws(()=>codec.decode(raw(legacy8)),'Validate legacy camera fields before discarding them');legacy8.media.mirror=true;
const legacy7={...structuredClone(legacy8),v:7};delete legacy7.words.verticalOrder;assert.deepEqual(codec.decode(raw(legacy7)),fixture);
const legacy6={...structuredClone(legacy8),v:6};delete legacy6.words;assert.deepEqual(codec.decode(raw(legacy6)),fixture);
assert.deepEqual(codec.decode(raw(legacy5)),fixture);
assert.deepEqual(codec.decode(raw(legacy4)),fixture,'MR4 drops the removed border effect and retains every other setting');
legacy4.media.glints='true';assert.throws(()=>codec.decode(raw(legacy4)),'Validate the old field before discarding it');
fail(x=>x.media.glints=true);
assert.deepEqual(codec.decode(raw(legacy3)),fixture,'MR3 imports with neutral media appearance');
assert.deepEqual(codec.decode(raw(legacy2)),fixture);
const legacy1={...structuredClone(legacy2),v:1};legacy1.audio.depth=false;
assert.deepEqual(codec.decode(raw(legacy1)),fixture,'legacy depth does not override camera');
legacy1.camera.enabled=false;legacy1.rain.direction='toward';
const migrated=codec.decode(raw(legacy1));assert.equal(migrated.v,15);assert.equal(migrated.rain.direction,'down');assert.equal(Object.hasOwn(migrated.audio,'depth'),false);
assert.throws(()=>codec.decode('MR1.'+blob.slice(5)));
assert.throws(()=>codec.validate({...fixture,audio:{...fixture.audio,hueReact:NaN}}));
const polluted=JSON.parse(JSON.stringify(fixture).replace('"v":15','"__proto__":{"polluted":true},"v":9'));
assert.throws(()=>codec.decode(raw(polluted)));assert.equal({}.polluted,undefined);
for(const broken of ['', 'MR4.foo', 'MR3.=', 'MR3.a', 'MR3.%%%','MR3.'+'a'.repeat(12001),'MR3._w'])assert.throws(()=>codec.decode(broken));
assert.throws(()=>codec.decode('MR3.'+Buffer.from('not json').toString('base64url')));
console.log(JSON.stringify({result:'PASS',utf8RoundTrip:true,leafFields:paths.length,blobCharacters:blob.length,strictValidation:true,prototypeKeysRejected:true,MR1ThroughMR10Migration:true,mediaControlsRoundTrip:true}));
const fs=require('node:fs'),vm=require('node:vm'),window={addEventListener(){}};
vm.runInNewContext(fs.readFileSync('rain-settings-share.js','utf8'),{window,document:{getElementById(){}},RainSettingsCodec:codec});
assert.equal(window.rainSettingsShare.defaults().trails.enabled,false,'Reset restores uniform tails');
assert.deepEqual(Object.keys(window.rainSettingsShare.defaults().media).sort(),['characters','contrast','dotDensity','exposure','gamma','influence']);
module.exports=fixture;
