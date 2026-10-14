// Decode ahead of the file's playback clock, then reveal actual timestamped words.
(function(){
    'use strict';
    let run=null,serial=0,retirement=Promise.resolve();
    function stop(){
        const old=run;run=null;serial++;if(!old)return retirement;
        old.reject?.(Error('Words stopped'));old.reject=null;
        const worker=old.worker;
        if(worker){
            // A replacement waits for disposal, including an unfinished load
            // or inference. A stuck worker is terminated before that wait ends.
            const cleanup=new Promise(resolve=>{
                let timeout;
                const finish=()=>{clearTimeout(timeout);worker.onmessage=worker.onerror=null;worker.terminate();resolve();};
                worker.onmessage=({data})=>{if(data.event==='disposed')finish();};worker.onerror=finish;
                timeout=setTimeout(finish,2000);
                try{worker.postMessage({action:'dispose'});}catch{finish();}
            });
            retirement=Promise.all([retirement,cleanup]).then(()=>{});
        }
        old.pcm=null;
        return retirement;
    }
    async function start(file,video,publish,say){
        stop();const id=++serial;const mine=run={id,video,pcm:null,worker:null,ready:false,busy:false,nextJob:0,coverage:[],downloads:{encoder:0,decoder:0},timeline:new window.RainWordTimeline(),publish,say,phrase:''};
        say('Preparing local lyrics in the background. Video playback continues…');
        try{
            await retirement;if(run!==mine)return;
            const Decoder=window.OfflineAudioContext||window.webkitOfflineAudioContext;
            const decoded=await new Decoder(1,1,16000).decodeAudioData(await file.arrayBuffer());
            if(run!==mine)return;
            const pcm=mine.pcm=new Float32Array(decoded.length);
            for(let channel=0;channel<decoded.numberOfChannels;channel++){const input=decoded.getChannelData(channel);for(let i=0;i<pcm.length;i++)pcm[i]+=input[i]/decoded.numberOfChannels;}
            const worker=mine.worker=new Worker('rain-timed-words-worker.js?v=181edbca5ceb',{type:'module'});
            await new Promise((resolve,reject)=>{
                mine.reject=reject;
                worker.onmessage=({data})=>{
                    if(run!==mine)return;
                    if(data.event==='progress'){
                        // Whisper's two model files download concurrently.
                        // Combine their progress instead of alternating two
                        // unrelated percentages in the same status line.
                        const part=/encoder/i.test(data.file)?'encoder':/decoder/i.test(data.file)?'decoder':null;
                        if(part){
                            const value=Number(data.progress);
                            if(Number.isFinite(value))mine.downloads[part]=Math.max(mine.downloads[part],Math.max(0,Math.min(100,value)));
                            const progress=(mine.downloads.encoder+mine.downloads.decoder)/2;
                            say(progress===100?'Starting local Whisper English · model files ready.':
                                'Preparing local Whisper English · model download '+Math.floor(progress)+'% · one recognizer, two model files.');
                        }
                    }
                    if(data.event==='ready'){mine.ready=true;mine.reject=null;resolve();}
                    if(data.event==='error'){mine.reject=null;reject(Error(data.message));}
                };
                worker.onerror=e=>reject(Error(e.message));
                worker.postMessage({action:'load',device:navigator.gpu?'webgpu':'wasm'});
            });
            if(run!==mine)return;
            worker.onmessage=({data})=>{
                if(run!==mine)return;
                if(data.event==='error'){mine.busy=false;window.rainMediaWords.stop('Timed recognition failed: '+data.message);return;}
                if(data.event!=='result'||data.id!==mine.job.id)return;
                const job=mine.job;mine.busy=false;
                mine.timeline.add(data.chunks,job.offset,job.from,job.to);mine.coverage.push([job.from,job.to]);
                const el=document.getElementById('media-words-status');if(el)Object.assign(el.dataset,{inferenceSeconds:data.seconds.toFixed(2),timedWords:String(mine.timeline.words.length)});
                tick();
            };
            worker.onerror=e=>{if(run===mine)window.rainMediaWords.stop('Timed recognition failed: '+e.message);};
            mine.reject=null;tick();
        }catch(error){if(run===mine){say('Timed words could not start: '+error.message);stop();throw error;}}
    }
    function covered(mine,time){return mine.coverage.some(([a,b])=>time>=a&&time<b);}
    function request(mine,time){
        if(mine.busy||!mine.ready||!mine.pcm)return;
        const duration=mine.pcm.length/16000,from=Math.max(0,Math.floor(time/10)*10),to=Math.min(duration,from+10),offset=Math.max(0,from-2),end=Math.min(duration,to+2);
        if(to<=from)return;
        const pcm=mine.pcm.slice(Math.floor(offset*16000),Math.ceil(end*16000));
        let energy=0;for(const value of pcm)energy+=value*value;
        if(Math.sqrt(energy/Math.max(1,pcm.length))<.002){mine.coverage.push([from,to]);return;}
        mine.busy=true;mine.job={id:mine.id+':'+(++mine.nextJob),offset,from,to};
        mine.worker.postMessage({action:'recognize',id:mine.job.id,pcm},[pcm.buffer]);
    }
    function tick(){
        const mine=run;if(!mine||!mine.ready||window.rainSessionControls?.stopped||document.hidden)return;
        const time=mine.video.currentTime;
        const prepared=covered(mine,time);
        // Recognition never pauses or resumes the player's video.
        const phrase=mine.timeline.at(time,window.rainMediaWords.options.maxWords);
        if(phrase&&phrase!==mine.phrase){mine.phrase=phrase;mine.publish(phrase);}
        if(!prepared){
            request(mine,time);
            mine.say('Playback continues · recognizing words · last lyrics stay until new words arrive.');
        }else{
            mine.say('Timed words follow the video’s playback clock. Last lyrics stay through gaps.');
            // Fill the closest missing section first; farther lookahead must
            // not skip a gap immediately after the current section.
            const duration=mine.pcm.length/16000;
            for(let next=Math.floor(time/10)*10+10;next<duration&&next<=time+30;next+=10){
                if(!covered(mine,next)){request(mine,next);break;}
            }
        }
    }
    window.rainVideoWords={start,stop,tick,whenStopped(){return retirement;},get active(){return !!run;}};
})();
