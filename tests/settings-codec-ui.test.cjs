const assert=require('node:assert/strict'),codec=require('./load-runtime.cjs')('rain-settings-codec.js');
const fixture={v:3,name:'Zen 雨 🎵',
    rain:{pattern:'classic',speed:35,intensity:70,density:50,fontSize:10,primary:'#00ff41',secondary:'#00cc33',characterSet:'custom',customCharacters:'雨∑M123🪐',direction:'down',reverse:false},
    audio:{preset:'zen',beatTurns:false,fluctuation:500,hueReact:60,saturationGain:60,brightnessDepth:80,spread:.8,trebleHueRange:16,saturationFloor:45,brightnessMin:52,brightnessMax:80},
    camera:{enabled:true,mode:'gyroscope',yaw:15.25,pitch:20,roll:-10,speeds:{showcase:25,corkscrew:30,gyroscope:20}},
    render:{quality:'sharp',sharp:true,smooth:true,glow:15,contrast:100},
    trails:{enabled:true,stepped:true,minimum:12,maximum:100}};
const blob=codec.encode(fixture);assert.match(blob,/^MR3\.[A-Za-z0-9_-]+$/);assert.deepEqual(codec.decode(blob),fixture);
assert.equal(codec.encode(codec.decode(blob)),blob);assert.deepEqual(codec.decode(blob.slice(0,40)+'\n'+blob.slice(40)),fixture);
const raw=x=>'MR'+x.v+'.'+Buffer.from(JSON.stringify(x)).toString('base64url');
const fail=edit=>{const x=structuredClone(fixture);edit(x);assert.throws(()=>codec.decode(raw(x)));};
fail(x=>x.v=4);fail(x=>x.rain.fontSize=101);fail(x=>x.camera.speeds.gyroscope=-1);fail(x=>x.render.glow='15');
fail(x=>x.rain.fontSize=23.2);fail(x=>x.trails.minimum=120);fail(x=>x.audio.brightnessMin=99);fail(x=>x.rain.characterSet='particles');
fail(x=>x.rain.primary='<script>');fail(x=>x.rain.customCharacters='x'.repeat(513));fail(x=>x.name='x'.repeat(61));
fail(x=>x.rain.customCharacters=' ');fail(x=>{x.camera.enabled=false;x.rain.direction='toward';});
fail(x=>x.preview={motion:'original',color:'original'});fail(x=>x.audio.mediaAccess=true);fail(x=>x.audio.depth=true);
const paths=codec.paths();
for(const p of paths){const x=structuredClone(fixture),keys=p.split('.'),leaf=keys.pop();let parent=x;for(const k of keys)parent=parent[k];delete parent[leaf];assert.throws(()=>codec.validate(x),p);}
const legacy2={...structuredClone(fixture),v:2,preview:{motion:'original',color:'original'}};
assert.deepEqual(codec.decode(raw(legacy2)),fixture);
const legacy1={...structuredClone(legacy2),v:1};legacy1.audio.depth=false;
assert.deepEqual(codec.decode(raw(legacy1)),fixture,'legacy depth does not override camera');
legacy1.camera.enabled=false;legacy1.rain.direction='toward';
const migrated=codec.decode(raw(legacy1));assert.equal(migrated.v,3);assert.equal(migrated.rain.direction,'down');assert.equal(Object.hasOwn(migrated.audio,'depth'),false);
assert.throws(()=>codec.decode('MR1.'+blob.slice(4)));
assert.throws(()=>codec.validate({...fixture,audio:{...fixture.audio,hueReact:NaN}}));
const polluted=JSON.parse(JSON.stringify(fixture).replace('"v":3','"__proto__":{"polluted":true},"v":3'));
assert.throws(()=>codec.decode(raw(polluted)));assert.equal({}.polluted,undefined);
for(const broken of ['', 'MR4.foo', 'MR3.=', 'MR3.a', 'MR3.%%%','MR3.'+'a'.repeat(12001),'MR3._w'])assert.throws(()=>codec.decode(broken));
assert.throws(()=>codec.decode('MR3.'+Buffer.from('not json').toString('base64url')));
console.log(JSON.stringify({result:'PASS',utf8RoundTrip:true,leafFields:paths.length,blobCharacters:blob.length,strictValidation:true,prototypeKeysRejected:true,MR1andMR2Migration:true}));
module.exports=fixture;
