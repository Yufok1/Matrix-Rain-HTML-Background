// Formation follows musical drive; the accepted steering controller still dances.
// A causal phrase memory compares spectral gestures and accent timing. It never
// predicts a singer, instrument, chord or time signature, and never buffers audio.
(function(root){
    'use strict';
    const modes=['directed','counterflow','crossflow'];
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const median=a=>{const s=a.slice().sort((a,b)=>a-b);return s[Math.floor(s.length/2)];};
    class RainAudioFlow {
        constructor(){this.reset();}
        reset(mode='directed'){
            this.stage=Math.max(0,modes.indexOf(mode));this.at=null;this.started=null;
            this.changedAt=-Infinity;this.lastAttack=null;this.pulseAt=null;
            this.intervals=[];this.period=0;this.confidence=0;this.pulses=0;
            this.drive=null;this.releaseEvidence=0;this.travel=1;this.previousImpulse=0;
            this.silence=0;this.trace=[];
            this.notes=[];this.serial=0;this.phraseLength=0;this.phraseScore=0;
            this.phraseProposal=0;this.phraseVotes=0;this.peakPhase=0;this.softPhase=0;
            this.shortScene=new Float32Array(6);this.longScene=new Float32Array(6);
            this.contrast=0;this.budget=0;this.lastRegion=-1;
            this.snapshot={mode:modes[this.stage],changed:false,reason:'Listening for musical phrasing',pulseMs:0,confidence:0};
        }
        observePulse(now){
            if(this.lastAttack!==null){
                let interval=now-this.lastAttack;
                if(interval<220)return false;
                // A missed attack can span two pulses. Do not manufacture the missing beat.
                if(this.period&&interval>this.period*1.65&&interval<this.period*2.35)interval/=2;
                if(interval>=240&&interval<=1200){
                    this.intervals.push(interval);if(this.intervals.length>8)this.intervals.shift();
                    this.period=median(this.intervals);
                    const consistent=this.intervals.filter(v=>Math.abs(v-this.period)<this.period*.18).length;
                    this.confidence=Math.min(1,consistent/4)*consistent/this.intervals.length;
                }else{this.intervals.length=0;this.period=0;this.confidence=0;}
            }
            this.lastAttack=now;this.pulseAt=now;this.pulses++;return true;
        }
        remember(now,shape,strength){
            const last=this.notes.at(-1),note={id:this.serial++,time:now,shape:shape.slice(),strength,
                interval:last?now-last.time:0};
            this.notes.push(note);if(this.notes.length>72)this.notes.shift();
            const n=this.notes.length;let best=0,bestScore=0;
            for(let length=2;length<=12&&length*2+1<=n;length++){
                let distance=0,diversity=0;
                for(let i=n-length;i<n;i++){
                    const a=this.notes[i],b=this.notes[i-length],next=this.notes[n-length+(i-(n-length)+1)%length];
                    let shapeDistance=0;
                    for(let j=0;j<6;j++){shapeDistance+=Math.abs(a.shape[j]-b.shape[j]);diversity+=Math.abs(a.shape[j]-next.shape[j]);}
                    distance+=shapeDistance*.65+Math.abs(a.strength-b.strength)*.17+
                        Math.min(1,Math.abs(Math.log(Math.max(1,a.interval)/Math.max(1,b.interval))))*.18;
                }
                diversity/=length;
                const score=1-distance/length-length*.002;
                // Identical ticks have no evidence for a particular phrase length.
                if(diversity>.025&&score>.77&&score>bestScore+.004){bestScore=score;best=length;}
            }
            if(best===this.phraseLength){this.phraseScore=bestScore;this.phraseVotes=0;}
            else if(best){
                if(this.phraseProposal===best)this.phraseVotes++;else{this.phraseProposal=best;this.phraseVotes=1;}
                if(this.phraseVotes>=3){this.phraseLength=best;this.phraseScore=bestScore;this.phraseVotes=0;}
            }else this.phraseScore*=.85;
            if(this.phraseLength&&this.phraseScore>.70){
                const sums=new Float32Array(this.phraseLength),counts=new Uint8Array(this.phraseLength);
                for(const a of this.notes.slice(-this.phraseLength*3)){const phase=a.id%this.phraseLength;sums[phase]+=a.strength;counts[phase]++;}
                let peak=0,soft=0;
                for(let i=0;i<sums.length;i++){
                    sums[i]/=Math.max(1,counts[i]);if(sums[i]>sums[peak])peak=i;if(sums[i]<sums[soft])soft=i;
                }
                this.peakPhase=peak;this.softPhase=soft;
            }
            return note;
        }
        update(analysis,motion,now){
            if(!Number.isFinite(now))return this.snapshot;
            const gap=this.at===null||now-this.at>300||now<this.at;
            const dt=gap?1000/60:clamp(now-this.at,0,100);this.at=now;
            if(gap){
                this.started=now;this.releaseEvidence=0;this.lastAttack=null;
                this.intervals.length=0;this.period=0;this.confidence=0;this.pulses=0;
                this.silence=0;this.previousImpulse=motion.impulse||0;
                this.notes.length=0;this.serial=0;this.phraseLength=0;this.phraseScore=0;
                this.phraseProposal=0;this.phraseVotes=0;this.budget=0;this.lastRegion=-1;
            }
            const energy=Math.max(0,analysis.fastEnergy||0),bands=analysis.bandFast||[];
            let total=0,squares=0,maximum=0;
            for(const value of bands){const b=Math.max(0,Number(value)||0);total+=b;squares+=b*b;maximum=Math.max(maximum,b);}
            const breadth=squares>1e-8?clamp((total*total/squares-1)/5,0,1):0;
            const shape=Array.from({length:6},(_,i)=>Math.max(0,bands[i]||0)/Math.max(.001,total));
            let sceneDistance=0;
            for(let i=0;i<6;i++){
                if(gap)this.shortScene[i]=this.longScene[i]=shape[i];
                this.shortScene[i]+=(shape[i]-this.shortScene[i])*(1-Math.exp(-dt/350));
                this.longScene[i]+=(shape[i]-this.longScene[i])*(1-Math.exp(-dt/3600));
                sceneDistance+=Math.abs(this.shortScene[i]-this.longScene[i]);
            }
            const relative=clamp(energy/Math.max(.12,analysis.energyPeak||0),0,1);
            const target=.52*relative+.28*breadth+.20*clamp(motion.impulse||0,0,1);
            this.drive=this.drive===null||gap?target:this.drive+(target-this.drive)*(1-Math.exp(-dt/300));
            this.silence=maximum<.012?this.silence+dt:0;
            // Texture changes remain steering events, but only a rising attack counts as a pulse.
            const attack=!!motion.accent&&(motion.flux||0)>.015&&(motion.impulse||0)>this.previousImpulse+.035;
            const pulse=attack&&this.observePulse(now);
            this.previousImpulse=motion.impulse||0;
            if(this.lastAttack!==null&&now-this.lastAttack>Math.max(2200,this.period*4))this.confidence=0;
            const falling=energy<(analysis.slowEnergy||0)*.80;
            this.releaseEvidence=falling?Math.min(3000,this.releaseEvidence+dt):0;
            const residence=now-this.changedAt;
            const settled=now-this.started>=650;
            const spacing=Math.max(1400,this.confidence>=.5?this.period*1.8:0);
            if(this.stage===0)this.travel=1;
            if(this.stage===2)this.travel=-1;
            let note=null;
            if(motion.accent&&!gap){
                const changedRegion=motion.region>=0&&this.lastRegion>=0&&motion.region!==this.lastRegion;
                const strength=clamp((motion.flux||0)*3+(motion.impulse||0)*.55+clamp(motion.texture||0,0,1)*.65,0,2);
                this.budget+=.18+strength*.6+(changedRegion?.25:0)+sceneDistance*.8;
                this.lastRegion=motion.region;
                // Keep rhythmic memory at observed attacks, not every vocal texture event.
                if(pulse)note=this.remember(now,shape,strength);
            }
            const known=this.phraseLength>0&&this.phraseScore>.77;
            const landmark=note&&known&&note.id%this.phraseLength===(this.travel>0?this.peakPhase:this.softPhase);
            const elapsed=now-(Number.isFinite(this.changedAt)?this.changedAt:this.started);
            const expected=clamp(this.period*(known?this.phraseLength:4.5)||3000,1800,8500);
            const arrival=motion.accent&&(sceneDistance>.10||(motion.texture||0)>.26)&&this.budget>1.25;
            const contrast=motion.accent&&this.budget>(known?4.5:3.4)&&elapsed>=expected;
            const phrase=this.silence<100&&(landmark||arrival||contrast);
            const collapse=this.stage===2&&(this.silence>950||
                (energy<Math.max(.001,(analysis.slowEnergy||0)*.25)&&this.releaseEvidence>Math.max(750,this.period*1.4)));
            const deepRelease=this.stage===2&&(this.silence>300||energy<(analysis.slowEnergy||0)*.25);
            const release=(this.silence>650||this.releaseEvidence>=Math.max(450,this.confidence>=.5?this.period*.8:0))&&(!deepRelease||collapse);
            const request=release?-1:this.travel;
            let changed=false,reason='Holding the current formation';
            if(settled&&residence>=spacing&&(phrase||release)&&!(release&&this.stage===0)){
                const from=modes[this.stage];this.stage=collapse?0:clamp(this.stage+request,0,2);
                this.travel=request;this.changedAt=now;this.pulses=0;this.releaseEvidence=0;this.budget=0;changed=true;
                reason=collapse?'Gathering on a breakdown':release?'Gathering on a release':landmark?'Returning musical motif':arrival?'New musical gesture':'Accumulated musical contrast';
                this.trace.push({time:Math.round(now),from,to:modes[this.stage],reason,drive:+this.drive.toFixed(3),motif:this.phraseLength});
                if(this.trace.length>96)this.trace.shift();
            }
            this.snapshot={mode:modes[this.stage],changed,reason,drive:this.drive,pulseMs:this.period,confidence:this.confidence,
                motif:this.phraseLength,motifConfidence:this.phraseScore,contrast:sceneDistance};
            return this.snapshot;
        }
    }
    root.RainAudioFlow=RainAudioFlow;
    if(typeof module==='object'&&module.exports)module.exports=RainAudioFlow;
})(typeof window==='object'?window:globalThis);
