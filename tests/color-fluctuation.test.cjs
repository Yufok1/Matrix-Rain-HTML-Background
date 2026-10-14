const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'rain-color-fluctuation.js'),'utf8'),context);
const Response=context.window.RainColorFluctuation;
const fixtures=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/visual-reference.json'),'utf8'));
const response=new Response();let previousGain;
for(const [hue,gain,preset,hueGain,expected]of fixtures.colors){
    if(gain!==previousGain)response.reset();previousGain=gain;
    assert.equal(response.applyHue(hue,gain,preset,hueGain),expected,'Reference hue-fluctuation parity');
}
response.reset();assert.equal(response.applyHue(359,300,0,1),359);assert.equal(response.applyHue(1,300,0,1),5,'Amplify the short arc across zero');
for(let i=0;i<1000;i++)assert.equal(response.applyHue(1,300,0,1),5,'Steady sound cannot cause arbitrary color cycling');
assert.equal(response.applyHue(359,300,0,1),359,'Reversed input retraces hue changes without drift');
assert.equal(response.applyHue(80,300,4,1),80,'Preset changes take the actual preset hue');
assert.equal(response.applyHue(81,100,4,1),81,'Changing to 100% restores baseline hue');
assert.equal(response.applyHue(82,100,4,1),82);
console.log(`${fixtures.colors.length} reference fluctuation fixtures passed; wrap, held input, resets and 100% baseline preserved.`);
