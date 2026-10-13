// Brief virtual reflections near a repeating cell face. The real path is intact.
(function(){
    'use strict';
    const entries=new Map();let volume=null;
    const options={enabled:true},stats={crossings:0,reflections:0};
    function reset(){entries.clear();volume=null;stats.reflections=0;}
    function capture(mark,camera){
        if(!options.enabled)return;
        if(volume!==camera.volume){reset();volume=camera.volume;}
        const d=mark.delta,axis=Math.abs(d[0])>=Math.abs(d[1])&&Math.abs(d[0])>=Math.abs(d[2])?0:Math.abs(d[1])>=Math.abs(d[2])?1:2;
        if(Math.abs(d[axis])<.01)return;
        const p=[mark.x,mark.y,mark.z],box=camera.volume;
        const lows=[-box.x/2,-box.y/2,box.zMin],highs=[box.x/2,box.y/2,box.zMin+box.z];
        const sign=Math.sign(d[axis]),face=sign>0?highs[axis]:lows[axis],distance=(face-p[axis])*sign;
        const key=String(mark.streamId),previous=entries.get(key),range=mark.fontSize*1.7;
        // A wrap or turn ends reflections immediately, including their tails.
        if(previous&&(previous.axis!==axis||previous.sign!==sign||distance>previous.distance+range)){
            entries.delete(key);stats.crossings++;
        }
        if(distance<0||distance>range){entries.delete(key);return;}
        entries.set(key,{mark,axis,sign,face,distance,range,frame:camera.frame});
        // Bound this independently of the number of repeated world cells.
        if(entries.size>160)entries.delete(entries.keys().next().value);
    }
    function prepare(camera,phase=1){
        const marks=[];if(!options.enabled){reset();return marks;}
        const now=camera.frame-1;
        for(const [key,entry]of entries){
            const {mark,axis,sign,face,range}=entry;
            if(now-entry.frame>1){entries.delete(key);continue;}
            const p=[mark.x,mark.y,mark.z];
            const distance=entry.distance-Math.abs(mark.delta[axis])*phase;
            if(distance<=0)continue;
            const a=(axis+1)%3,b=(axis+2)%3,visibility=Math.min(1,(range-distance)/(range*.4));
            for(let echo=0;echo<4;echo++)for(let tail=0;tail<3;tail++){
                const q=p.slice(),spread=distance*(1+tail*.22);
                // All four approach this same crossing from the far side.
                q[axis]=face+sign*spread*(echo<2?1:.65);
                q[a]+=(echo===0?1:echo===1?-1:0)*spread*.42;
                q[b]+=(echo===2?1:echo===3?-1:0)*spread*.42;
                marks.push({...mark,x:q[0],y:q[1],z:q[2],fontSize:mark.fontSize*(1-tail*.08),
                    alpha:mark.alpha*visibility*(tail===0?.16:tail===1?.065:.025),frame:now,trailLength:3,delta:[0,0,0],mediaStrength:0});
            }
        }
        stats.reflections=marks.length;return marks;
    }
    window.rainBorderGlints={capture,prepare,reset,options,stats};
})();
