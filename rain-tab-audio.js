// Shared-tab audio routing adapted from Canvas-5, Jeff Towers.
// See vendor/canvas5/LICENSE.txt. Picture and sound remain live.
(function(root){
    'use strict';
    function create(stream){
        const track=stream.getAudioTracks().find(t=>t.readyState==='live');if(!track)return null;
        const context=new (root.AudioContext||root.webkitAudioContext)();
        try{
            const input=context.createMediaStreamSource(new MediaStream([track]));
            const analyser=context.createAnalyser(),suppressed=track.getSettings?.().suppressLocalAudioPlayback===true;
            analyser.fftSize=2048;analyser.smoothingTimeConstant=.2;
            input.connect(analyser);
            // Monitor only when capture suppresses the original tab's sound.
            // Otherwise it stays audible there, without duplicate playback.
            if(suppressed)input.connect(context.destination);
            let disposed=false;
            return {context,analyser,suppressed,dispose(){
                if(disposed)return;disposed=true;
                input.disconnect();analyser.disconnect();context.close().catch(()=>{});
            }};
        }catch(error){context.close().catch(()=>{});throw error;}
    }
    root.RainTabAudio={create};
})(typeof window==='undefined'?globalThis:window);
