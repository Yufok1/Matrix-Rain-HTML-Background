const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const context=vm.createContext({window:{matrixRainRendering:{quality:'balanced'}},matrixCanvas:{width:1320,height:900},rainFocalLength:500,
    rainCameraGPU:{render(){},hide(){}},performance});
vm.runInContext(read('rain-camera-motion.js'),context);
const motion=context.window.RainCameraMotion;
const fixtures=JSON.parse(read('tests/fixtures/android-visuals.json'));
for(const sample of fixtures.camera){
    const a=motion.angles(sample.mode,sample.seconds),r=motion.rotation(a.yaw,a.pitch,a.roll);
    r.forEach((x,i)=>assert.ok(Math.abs(x-sample.rows[i])<1e-6,'Native APK orientation parity'));
    for(let i=0;i<3;i++)for(let j=0;j<3;j++)assert.ok(Math.abs(r[i*3]*r[j*3]+r[i*3+1]*r[j*3+1]+r[i*3+2]*r[j*3+2]-(i===j?1:0))<1e-12);
}
const camera=vm.runInContext(read('rain-camera.js').split("window.addEventListener('DOMContentLoaded'")[0]+';rainCamera;',context);
camera.ensureVolume();camera.marks.push({x:20,y:30,z:250,char:'A',frame:0,color:'#00ff41'});
const history=JSON.stringify(camera.marks),volume=camera.volume;
let samples=0;
for(const mode of ['showcase','corkscrew','gyroscope']){
    camera.yaw=camera.pitch=camera.roll=0;camera.setMode(mode);
    camera.present(0,1);
    for(let frame=1;frame<=240;frame++)camera.present(frame*1000/60,1);
    assert.ok(Math.abs(camera.motionTime-4*.25*camera.phaseRates[mode])<1e-8,'Every mode uses its calibrated quarter-speed default');
    assert.ok(camera.yaw!==0&&camera.pitch!==0);if(mode!=='showcase')assert.ok(camera.roll!==0);
    const before=[camera.yaw,camera.pitch,camera.roll];camera.present(60000,1);
    assert.deepEqual([camera.yaw,camera.pitch,camera.roll],before,'A hidden interval cannot advance the automatic view');
    assert.equal(JSON.stringify(camera.marks),history,'Animated view leaves historical trail marks fixed');
    assert.equal(camera.volume,volume,'Mode selection retains the repeating world');
}
camera.speeds.gyroscope=0;const paused=[camera.yaw,camera.pitch,camera.roll];camera.present(60016,1);
assert.deepEqual([camera.yaw,camera.pitch,camera.roll],paused,'Zero motion speed pauses the viewpoint without changing rain motion');
camera.setMode('fixed');
for(let i=0;i<75;i++){
    camera.yaw=i*37%360-180;camera.pitch=i*53%360-180;camera.roll=i*71%360-180;camera.prepareView();
    const box=camera.volume,r=camera.rotation,tiles=new Set(camera.tiles.map(t=>t.offset.map((n,a)=>Math.round(n/[box.x,box.y,box.z][a])).join(',')));
    for(const z of [41,120,500,1250,1999])for(const px of [-.98,0,.98])for(const py of [-.98,0,.98]){
        const x=px*box.width/2*z/500,y=py*box.height/2*z/500,dz=z-500;
        const world=[r[0]*x+r[3]*y+r[6]*dz,r[1]*x+r[4]*y+r[7]*dz,r[2]*x+r[5]*y+r[8]*dz+500];
        const cell=[Math.floor((world[0]+box.x/2)/box.x),Math.floor((world[1]+box.y/2)/box.y),Math.floor((world[2]-box.zMin)/box.z)];
        assert.ok(tiles.has(cell.join(',')),'Full roll/pitch frustum has no missing world cell');samples++;
    }
}
camera.yaw=camera.pitch=0;camera.roll=90;
const projected=camera.project({x:100,y:0,z:500,fontSize:10});
assert.ok(Math.abs(projected.x-660)<1e-8&&Math.abs(projected.y-350)<1e-8,'A quarter roll rotates view projection consistently');
console.log(`${fixtures.camera.length} native APK camera fixtures and ${samples} full-rotation frustum samples passed; fixed historical trails and pause recovery preserved.`);
