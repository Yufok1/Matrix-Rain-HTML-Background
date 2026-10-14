// Source-track/local-pack lifecycle adapted from Canvas-5, Jeff Towers.
// See vendor/canvas5/LICENSE.txt. No microphone or remote recognizer fallback.
(function(){
    'use strict';
    let enabled=true,wanted=false,suspended=false,generation=0,recognition=null,timer=null,phrase='',letters=[],positions=new Map(),prepared=false;
    let status='Lyrics start automatically with a video or a shared tab with audio.';
    const options={maxWords:3,bufferMs:1900,verticalOrder:'down'};
    const live={maxWords:3,instantWords:true};
    const picker=Canvas5Words.createSpeechResultPicker();
    const delivery=Canvas5Words.createSpeechWindow({live,emit(text){
        publish(text);
    }});
    function publish(text){
        if(!String(text||'').trim())return;
        const first=!letters.length;phrase=text;letters=Array.from(text.replace(/\s+/g,' '));
        if(first&&typeof rainCamera!=='undefined')rainCamera.replaceCharacters(id=>window.rainMediaWords.nextCharacter(id));
        refresh();
    }
    function sourceReady(){if(enabled&&window.rainMedia?.hasAudioSource)void start();}
    function deactivate(){enabled=false;stop('Lyrics deactivated. Playback and audio response continue.');}
    function activate(){enabled=true;if(window.rainMedia?.hasAudioSource)void start();else say('Lyrics start automatically with a video or a shared tab with audio.');refresh();}
    function resetAutoStart(){enabled=true;refresh();}
    function api(){const A=window.SpeechRecognition;return A&&typeof A.available==='function'&&typeof A.install==='function'&&'processLocally'in A.prototype?A:null;}
    const say=text=>{if(status===text)return;status=text;refresh();};
    function destroy(){clearTimeout(timer);timer=null;const old=recognition;recognition=null;if(old){old.onstart=old.onresult=old.onerror=old.onend=old.onspeechend=old.onaudiostart=null;try{old.abort();}catch{}}}
    function stop(message='Words stopped. Normal character selection restored.',resumePlayback=true){
        wanted=false;suspended=false;generation++;window.rainVideoWords?.stop(resumePlayback);destroy();window.rainMedia?.releaseSpeech?.();delivery.reset();picker.reset();phrase='';letters=[];positions.clear();window.rainMedia?.setWordSync(false);say(message);
    }
    function bounded(promise,ms){return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Local speech preparation timed out. Reactivate words to try again.')),ms);Promise.resolve(promise).then(v=>{clearTimeout(timeout);resolve(v);},e=>{clearTimeout(timeout);reject(e);});});}
    async function prepare(A,mine){
        const request={langs:['en-US'],processLocally:true};
        let state=await bounded(A.available(request),5000);
        if(mine!==generation||!wanted)return false;
        if(state==='available')return true;
        if(state==='unavailable')throw Error('Local English speech is unavailable in this browser. Use a Chrome version with on-device speech.');
        say('Preparing the browser’s local English pack… (up to 45 seconds)');
        if(state==='downloadable'){
            if(!await bounded(A.install(request),45000))throw Error('The browser could not prepare local English speech.');
        }else{
            const deadline=performance.now()+45000;
            while(mine===generation&&wanted&&performance.now()<deadline){
                await new Promise(resolve=>setTimeout(resolve,1000));
                state=await bounded(A.available(request),3000);if(state==='available')break;
            }
        }
        if(mine!==generation||!wanted)return false;
        if(await bounded(A.available(request),5000)!=='available')throw Error('Local English preparation did not finish. Reactivate words shortly.');
        return true;
    }
    function begin(track,mine){
        if(!wanted||suspended||mine!==generation)return;
        if(track?.readyState!=='live'||track.kind!=='audio'){stop('The selected source has no live audio track.');return;}
        destroy();picker.reset();delivery.reset();
        const next=recognition=new (api())();
        next.lang='en-US';next.processLocally=true;next.continuous=true;next.interimResults=true;next.maxAlternatives=1;
        const valid=()=>wanted&&!suspended&&mine===generation&&recognition===next;
        const startedAt=performance.now();
        const diagnostics=document.getElementById('media-words-status');
        if(diagnostics)Object.assign(diagnostics.dataset,{audioStarted:'false',resultEvents:'0',lastResultMs:'0'});
        next.onaudiostart=()=>{if(valid()&&diagnostics)diagnostics.dataset.audioStarted='true';};
        next.onstart=()=>{if(valid()){window.rainMedia?.setWordSync(true);say('Listening locally to '+window.rainMedia?.audioLabel+'. Latest words become the rain.');}};
        next.onresult=event=>{if(!valid())return;if(diagnostics){diagnostics.dataset.resultEvents=String(Number(diagnostics.dataset.resultEvents||0)+1);diagnostics.dataset.lastResultMs=String(Math.round(performance.now()-startedAt));}const result=picker.choose(event);if(result)delivery.update(result.text,result.final);};
        // Continuous listening keeps receiving new words without reopening
        // the source between musical phrases.
        next.onerror=event=>{if(!valid()||event.error==='no-speech'||event.error==='aborted')return;stop('Local words failed: '+event.error+'. No cloud fallback was used.');};
        next.onend=()=>{if(valid())timer=setTimeout(async()=>{
            if(!valid())return;
            try{const stream=await window.rainMedia.connectSpeech();if(valid())begin(stream.getAudioTracks().find(t=>t.readyState==='live'),mine);}
            catch(error){if(valid())stop('Local words could not reconnect: '+error.message);}
        },35);};
        try{next.start(track);}catch(error){stop('This browser could not recognize the source audio: '+error.message);}
    }
    async function start(){
        enabled=true;if(wanted)return;
        wanted=true;suspended=false;prepared=false;const mine=++generation;
        // Source changes can switch between Whisper and browser speech.
        // Finish retiring the file worker before opening either replacement.
        await window.rainVideoWords?.whenStopped?.();if(mine!==generation||!wanted)return;
        if(window.rainMedia?.file){
            try{await window.rainVideoWords.start(window.rainMedia.file,window.rainMedia.source,text=>{
                if(!wanted||mine!==generation)return;publish(text);
            },text=>{if(wanted&&mine===generation)say(text);});if(wanted&&mine===generation)prepared=true;}catch(error){if(mine===generation)stop(error.message);}
            return;
        }
        const A=api();if(!A){stop('Local source-audio speech is unavailable in this browser. Use Chrome with on-device speech.');return;}
        say('Connecting the selected video’s audio…');
        try{
            const stream=await window.rainMedia.connectSpeech();
            if(mine!==generation||!wanted)return;
            const track=stream.getAudioTracks().find(t=>t.readyState==='live');
            if(!track)throw Error('This source has no shared audio. Share a tab with its audio enabled.');
            if(!await prepare(A,mine))return;prepared=true;
            if(mine!==generation||!wanted)return;
            if(window.rainMedia.playbackPaused){suspended=true;say('Words armed. Press Play video or Resume to listen.');return;}
            begin(track,mine);
        }catch(error){if(mine===generation)stop(error.message);}
    }
    function pause(){if(!wanted)return;suspended=true;destroy();window.rainMedia?.setWordSync(false);say('Words paused with the video.');}
    async function resume(){
        if(!wanted||!suspended)return;if(window.rainVideoWords?.active){suspended=false;return;}if(!prepared)return;suspended=false;const mine=generation;
        try{const stream=await window.rainMedia.connectSpeech();if(mine===generation)begin(stream.getAudioTracks().find(t=>t.readyState==='live'),mine);}catch(error){if(mine===generation)stop(error.message);}
    }
    function configure(value){
        options.maxWords=Math.max(1,Math.min(5,Math.round(Number(value.maxWords)||3)));
        options.bufferMs=Math.max(0,Math.min(3500,Math.round(Number(value.bufferMs)||0)));
        options.verticalOrder=value.verticalOrder==='up'?'up':'down';
        live.maxWords=options.maxWords;
        if(phrase){const text=phrase;delivery.reset();delivery.update(text,true);}
        window.rainMedia?.setWordSync(wanted&&!suspended);refresh();
    }
    function refresh(){
        const button=document.getElementById('media-words');if(!button)return;
        button.textContent=enabled?'Deactivate words':'Activate words';button.setAttribute('aria-pressed',String(enabled));
        button.disabled=false;
        document.getElementById('media-words-status').textContent=status;
        document.getElementById('media-words-latest').textContent=phrase||'—';
        document.getElementById('media-word-count').value=options.maxWords;
        document.getElementById('media-word-count-value').textContent=options.maxWords;
        document.getElementById('media-word-buffer').value=options.bufferMs;
        document.getElementById('media-word-buffer-value').textContent=(options.bufferMs/1000).toFixed(1)+' s';
        for(const button of document.querySelectorAll?.('[data-word-vertical]')||[])button.setAttribute('aria-pressed',String(button.dataset.wordVertical===options.verticalOrder));
    }
    function mount(panel){
        const box=document.createElement('div');box.innerHTML=`<div class="settings-row"><button id="media-words" type="button">Deactivate words</button></div>
        <p id="media-words-status" class="settings-hint" role="status"></p><output id="media-words-latest" aria-live="off"></output>
        <label for="media-word-count">Latest words<output id="media-word-count-value" class="settings-value"></output><input id="media-word-count" type="range" min="1" max="5" step="1"></label>
        <div role="group" aria-label="Vertical word reading" class="settings-row"><button type="button" data-word-vertical="down">Read downward</button><button type="button" data-word-vertical="up">Read upward</button></div>
        <label for="media-word-buffer">Shared-tab speech head start<output id="media-word-buffer-value" class="settings-value"></output><input id="media-word-buffer" type="range" min="0" max="3500" step="100"></label>
        <p class="settings-hint">Loaded videos use local Whisper with word timestamps and audio lookahead. Lyrics start automatically and prepare in the background without pausing playback. Deactivate words switches them off for this session; Activate words switches them back on. The last lyrics stay until new words arrive. First use downloads the recognizer assets. Shared tabs use on-device browser speech. Lyrics can be imperfect. Shared-tab buffering delays picture and sound together when the browser permits it; this is a head start, not exact word timing. No microphone or cloud recognition.</p>`;
        panel.appendChild(box);
        for(const button of box.querySelectorAll('[data-word-vertical]'))button.onclick=()=>configure({...options,verticalOrder:button.dataset.wordVertical});
        document.getElementById('media-words').onclick=()=>enabled?deactivate():activate();
        document.getElementById('media-word-count').oninput=event=>configure({...options,maxWords:event.target.value});
        document.getElementById('media-word-buffer').oninput=event=>configure({...options,bufferMs:event.target.value});refresh();
    }
    function tick(){
        if(window.rainVideoWords?.active){window.rainVideoWords.tick();return;}
    }
    window.rainMediaWords={start,stop,tick,pause,resume,mount,refresh,configure,sourceReady,deactivate,activate,resetAutoStart,options,
        get enabled(){return enabled;},
        get active(){return wanted&&!suspended;},
        get hasWords(){return wanted&&letters.length>0;},
        nextCharacter(id){
            if(!wanted)return null;
            if(!letters.length)return null; // Preserve the selected rain until real lyrics are ready.
            const previous=positions.get(id)||{index:0,order:1,letters:[]};
            const flow=typeof rainCamera==='undefined'?{dx:1,dy:0}:rainCamera.wordFlow(id);
            const order=window.RainWordReading?.order(flow.dx,flow.dy,options.verticalOrder,previous.order)??1;
            let index=order===previous.order?previous.index:0,word=previous.letters;
            if(index===0||!word.length){const pool=phrase.split(/\s+/).filter(Boolean);word=Array.from(pool[Math.abs(Number(id)||0)%pool.length]+' ');}
            const character=window.RainWordReading?window.RainWordReading.letter(word,index,order):word[index];
            positions.set(id,{index:(index+1)%word.length,order,letters:word});return character;
        }
    };
})();
