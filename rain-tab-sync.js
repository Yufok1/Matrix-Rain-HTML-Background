// Adapted from Canvas-5's synchronizedTabSample and ensureTabSyncAudio.
// Jeff Towers; see vendor/canvas5/LICENSE.txt.
(function(root){
    'use strict';
    class FrameDelay {
        constructor(){this.clear();}
        clear(){this.frames=[];this.bytes=0;this.key='';}
        sample(frame,now,delay,active){
            if(!delay){this.clear();return frame;}
            const key=frame.width+'x'+frame.height;
            if(key!==this.key){this.clear();this.key=key;}
            const frames=this.frames,bytes=frame.pixels.byteLength,budget=64*1024*1024;
            while(frames.length>1&&frames[1].at<now-delay-250)this.bytes-=frames.shift().bytes;
            const capacity=Math.max(3,Math.min(512,Math.floor(budget/Math.max(1,bytes))));
            const interval=(delay+250)/(capacity-2);
            if(!frames.length||now-frames[frames.length-1].at>=interval){frames.push({at:now,frame,bytes});this.bytes+=bytes;}
            while(frames.length>2&&(this.bytes>budget||frames.length>512))for(let i=frames.length-2;i>0;i-=2){this.bytes-=frames[i].bytes;frames.splice(i,1);}
            if(!active)return frame;
            for(let i=frames.length-1;i>=0;i--)if(frames[i].at<=now-delay)return frames[i].frame;
            return frames[0]?.frame||frame;
        }
    }
    function create(stream){
        const track=stream.getAudioTracks().find(t=>t.readyState==='live');if(!track)return null;
        const context=new (window.AudioContext||window.webkitAudioContext)();
        const input=context.createMediaStreamSource(new MediaStream([track]));
        const dry=context.createGain(),wet=context.createGain(),delay=context.createDelay(4),analyser=context.createAnalyser();
        const suppressed=track.getSettings?.().suppressLocalAudioPlayback===true;
        analyser.fftSize=2048;analyser.smoothingTimeConstant=.2;dry.gain.value=1;wet.gain.value=0;delay.delayTime.value=1.9;
        input.connect(dry);input.connect(delay);delay.connect(wet);dry.connect(analyser);wet.connect(analyser);
        if(suppressed){dry.connect(context.destination);wet.connect(context.destination);}
        let active=false;
        return {context,analyser,suppressed,get active(){return active;},
            mode(wanted,ms){active=!!(wanted&&suppressed&&ms>0);const now=context.currentTime;delay.delayTime.setValueAtTime(ms/1000,now);
                for(const [gain,target]of [[dry.gain,active?0:1],[wet.gain,active?1:0]]){gain.cancelScheduledValues(now);gain.setValueAtTime(gain.value,now);gain.linearRampToValueAtTime(target,now+.055);}},
            dispose(){input.disconnect();dry.disconnect();wet.disconnect();delay.disconnect();context.close().catch(()=>{});}
        };
    }
    root.RainTabSync={FrameDelay,create};
})(typeof window==='undefined'?globalThis:window);
