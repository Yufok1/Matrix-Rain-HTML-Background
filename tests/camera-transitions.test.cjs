const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync(name,'utf8');
let hidden=0,rendered=0;
const context=vm.createContext({window:{matrixRainRendering:{quality:'balanced'}},
    matrixCanvas:{width:1280,height:800},rainFocalLength:500,performance,
    rainCameraGPU:{render(){rendered++;},hide(){hidden++;}},
    rainMotion:{drops:[],planar:'down'},reverseFlowMultiplier:1,
    MatrixRainEngine:{rainConfig:{direction:'down'}}});
vm.runInContext(read('rain-camera-motion.js'),context);
const camera=vm.runInContext(read('rain-camera.js').split("window.addEventListener('DOMContentLoaded'")[0]+';rainCamera;',context);
camera.ensureVolume();camera.yaw=37;camera.pitch=-28;camera.roll=63;
const mark={x:80,y:45,z:360,fontSize:18,char:'雨',color:'#18cd90',frame:0};
camera.marks.push(mark);const stream={x:80,y:45,z:360};camera.streams.set(0,stream);
const history=JSON.stringify(camera.marks),volume=camera.volume,angles=[camera.yaw,camera.pitch,camera.roll];
const original=camera.project(mark);let now=0;camera.present(now);
for(const enabled of [false,true]){
    const before=camera.project(mark);camera.transitionDepth(enabled);
    assert.deepEqual(camera.project(mark),before,'Switch starts at the identical pixel and size');
    let previous=before;
    for(let i=0;i<250;i++){
        camera.present(now+=1000/60);
        const point=camera.project(mark);
        assert.ok(Math.hypot(point.x-previous.x,point.y-previous.y)<2,'No position jump during projection change');
        assert.ok(Math.abs(point.size-previous.size)<.2,'No font-size jump');
        previous=point;
        assert.deepEqual([camera.yaw,camera.pitch,camera.roll],angles,'Roll and perspective angle never reset');
        assert.equal(JSON.stringify(camera.marks),history,'Same world marks and colors');
        assert.equal(camera.streams.get(0),stream,'No reseed of stream continuity');
        assert.equal(camera.volume,volume);
    }
    assert.equal(camera.perspective,enabled?1:0);assert.equal(camera.depthTransition,null);
    if(!enabled){
        for(const z of [350,500,650])assert.equal(camera.project({...mark,z}).size,18,'Flat projection uses one font size');
        assert.equal(camera.active,true,'Flat endpoint retains the same renderer');
    }
}
assert.deepEqual(camera.project(mark),original,'Round trip restores the exact projection');
assert.equal(hidden,0);assert.ok(rendered>450);
camera.transitionDepth(false);camera.present(now+=16);
const held=camera.perspective;camera.lastTime=null;camera.present(now+=60000);
assert.equal(camera.perspective,held,'Emergency Stop/Resume cannot jump the interpolation');
camera.present(now+=60000);assert.equal(camera.perspective,held,'Hidden tab cannot catch up the transition');

// Inspect the real GPU culler too: projection, cell selection, and bounds must
// agree across the entire morph, including a rolled/tilted orthographic view.
const gpu=vm.runInNewContext(read('rain-camera-gpu.js')+';rainCameraGPU;',{
    window:{},matrixCanvas:context.matrixCanvas,rainFocalLength:500,performance});
let samples=0;
for(const mix of [0,.1,.5,.9,1])for(let angle=0;angle<30;angle++){
    camera.perspective=mix;camera.yaw=angle*37%360-180;camera.pitch=angle*53%360-180;camera.roll=angle*71%360-180;
    const b=camera.volume;camera.bounds={center:[0,0,b.zMin+b.z/2],half:[b.x/2,b.y/2,b.z/2],pad:30,motionMargin:0};
    camera.prepareView();const r=camera.rotation;
    const tiles=new Map(camera.tiles.map(t=>[t.offset.map((n,a)=>Math.round(n/[b.x,b.y,b.z][a])).join(','),t]));
    for(const z of [41,150,500,1250,1999])for(const px of [-.98,0,.98])for(const py of [-.98,0,.98]){
        const w=camera.projectionDepth(z),x=px*b.width/2*w/500,y=py*b.height/2*w/500,dz=z-500;
        const world=[r[0]*x+r[3]*y+r[6]*dz,r[1]*x+r[4]*y+r[7]*dz,r[2]*x+r[5]*y+r[8]*dz+500];
        const cell=[Math.floor((world[0]+b.x/2)/b.x),Math.floor((world[1]+b.y/2)/b.y),Math.floor((world[2]-b.zMin)/b.z)];
        const tile=tiles.get(cell.join(','));assert.ok(tile,'No missing cell during the morph');
        assert.ok(gpu.tileVisible(camera,tile),'GPU culling agrees with the projection');samples++;
    }
}

// Starting Auto in legacy flat view adopts its recorded tails and heads.
camera.continuous=false;camera.enabled=false;camera.depthTransition=null;
camera.marks.length=0;camera.streams.clear();
context.rainMotion.drops=[{x:200,y:300,depth:900,lastStamp:{x:200,y:300,depth:900}}];
camera.capture('雨',200,300,900,16,1,'#00ff41',0);
const flatMark=camera.marks[0];camera.beginContinuousView();
assert.equal(camera.marks[0],flatMark);assert.equal(context.rainMotion.drops[0].depth,500);
assert.deepEqual([camera.project(flatMark).x,camera.project(flatMark).y,camera.project(flatMark).size],[200,300,16]);
console.log(`PASS bidirectional continuous projection, retained roll/heads/history, flat-entry adoption, pause recovery and ${samples} GPU/frustum checks.`);
