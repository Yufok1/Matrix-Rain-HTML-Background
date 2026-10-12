const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const context=vm.createContext({window:{matrixRainRendering:{quality:'balanced'}},matrixCanvas:{width:1200,height:850},rainFocalLength:500,rainCameraGPU:{render(){},hide(){}},performance});
vm.runInContext(read('rain-camera-motion.js'),context);
const helper=context.window.RainCameraMotion;
const camera=vm.runInContext(read('rain-camera.js').split("window.addEventListener('DOMContentLoaded'")[0]+';rainCamera;',context);
camera.ensureVolume();camera.marks.push({x:15,y:22,z:500,char:'A',frame:0,trailLength:100,color:'#00ff41'});
const history=JSON.stringify(camera.marks),volume=camera.volume;
for(const mode of ['showcase','corkscrew','gyroscope']){
    assert.equal(camera.speeds[mode],.25);
    for(const percent of [.25,.5,1]){
        camera.yaw=camera.pitch=camera.roll=0;camera.setMode(mode);camera.speeds[mode]=percent;
        camera.present(0,1);for(let frame=1;frame<=120;frame++)camera.present(frame*1000/60,1);
        assert.ok(Math.abs(camera.motionTime-2*percent*camera.phaseRates[mode])<1e-8);
        const pose=[camera.yaw,camera.pitch,camera.roll];camera.speeds[mode]=0;camera.present(2016,1);
        assert.deepEqual([camera.yaw,camera.pitch,camera.roll],pose,'Zero speed holds every mode');
        camera.speeds[mode]=percent;camera.present(60000,1);
        assert.deepEqual([camera.yaw,camera.pitch,camera.roll],pose,'Hidden time cannot fast-forward a camera');
        assert.equal(JSON.stringify(camera.marks),history);assert.equal(camera.volume,volume);
    }
}
function angularMean(mode,scale){
    let previous,total=0;const frames=3600;
    for(let f=0;f<=frames;f++){
        const a=helper.angles(mode,f/60*scale),r=helper.rotation(a.yaw,a.pitch,a.roll);
        if(previous){const dot=r.reduce((s,v,i)=>s+v*previous[i],0);total+=Math.acos(Math.max(-1,Math.min(1,(dot-1)/2)));}previous=r;
    }
    return total*180/Math.PI/60;
}
const results=[.25,.5,1].map(percent=>{
    const gyro=angularMean('gyroscope',percent),showcase=angularMean('showcase',percent*10),corkscrew=angularMean('corkscrew',percent*3);
    for(const speed of [showcase,corkscrew])assert.ok(speed/gyro>.75&&speed/gyro<1.3,'Equal slider values give comparable measured angular travel');
    return {percent:percent*100,meanDegreesPerSecond:{showcase:+showcase.toFixed(3),corkscrew:+corkscrew.toFixed(3),gyroscope:+gyro.toFixed(3)}};
});
const source=read('rain-camera.js');assert.match(source,/matrixRain\.preview\.calibratedCameraSpeeds/);assert.doesNotMatch(source,/['"]matrixRain\.cameraSpeeds['"]/);
fs.writeFileSync(path.join(__dirname,'camera-speed-results.json'),JSON.stringify({result:'PASS',kind:'view-rotation matrix arc length over 60 seconds; not FPS',results,historyPreserved:true},null,2)+'\n');
console.log(JSON.stringify({result:'PASS',results}));
