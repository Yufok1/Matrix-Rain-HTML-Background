// Single is home. Musical events can launch finite Counterflow / Crossflow accents.
// Reads the accepted dancer's analysis; never alters its steering, speed or colors.
// See AUDIO-FLOW-RESEARCH.md: published detection methods vs original visual policy.
(function(root){
    'use strict';
    const modes=['directed','counterflow','crossflow'];
    const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
    const median=a=>{const s=a.slice().sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
    class RainAudioFlow {
        constructor(){this.reset();}
        reset(){
            // Saved manual patterns are restored by the owner, never inherited
            // as a permanent automatic formation when listening begins.
            this.stage=this.expansion=0;this.at=null;this.trace=[];this.silence=0;
            this.body=this.bed=this.deviation=0;this.bands=new Float32Array(6);
            this.fluxMean=this.fluxDeviation=this.previousFlux=0;this.armed=true;
            this.lastOnset=-Infinity;this.intervals=[];this.period=500;this.confidence=0;
            this.events=[];this.excitement=this.tension=0;this.lastAccent=false;
            this.started=this.deadline=null;this.recoverAt=this.crossRecoverAt=-Infinity;
            this.snapshot={mode:'directed',expansion:0,changed:false,drive:0,reason:'Listening for musical accents'};
        }
        update(analysis,motion,now){
            if(!Number.isFinite(now))return this.snapshot;
            const gap=this.at===null||now-this.at>300||now<this.at;
            const dt=gap?1000/60:clamp(now-this.at,0,100);this.at=now;
            const follow=(a,b,ms)=>a+(b-a)*(1-Math.exp(-dt/ms));
            const fast=analysis.bandFast||[],energy=Math.max(0,analysis.fastEnergy||0);
            let maximum=0,bandRise=0,shapeChange=0,total=0,reference=0;
            for(let i=0;i<6;i++){maximum=Math.max(maximum,Number(fast[i])||0);total+=Math.max(0,Number(fast[i])||0);reference+=this.bands[i];}
            this.silence=maximum<.012?this.silence+dt:0;
            if(gap){
                this.silence=maximum<.012?dt:0;
                this.recoverAt=this.crossRecoverAt=-Infinity;
                this.body=this.bed=energy;this.deviation=0;this.armed=true;
                this.fluxMean=this.fluxDeviation=this.previousFlux=0;
                this.excitement=this.tension=0;this.lastOnset=-Infinity;
                this.intervals=[];this.events=[];this.period=500;this.confidence=0;this.lastAccent=false;
                for(let i=0;i<6;i++)this.bands[i]=Math.max(0,Number(fast[i])||0);
            }
            this.body=follow(this.body,energy,120);
            const level=Math.log((this.body+.035)/(this.bed+.035));
            this.deviation=follow(this.deviation,Math.abs(level),6000);
            const scale=Math.max(.04,this.deviation*2.4);
            const lift=clamp(level/scale),fall=clamp(-level/scale);
            for(let i=0;i<6;i++){
                const value=Math.max(0,Number(fast[i])||0);
                bandRise+=Math.max(0,Math.log((value+.035)/(this.bands[i]+.035)));
                if(!gap)shapeChange+=Math.abs(value/Math.max(total,.001)-this.bands[i]/Math.max(reference,.001));
                this.bands[i]=follow(this.bands[i],value,1800);
            }
            bandRise=clamp(bandRise/(6*scale));
            const layer=clamp(shapeChange/.3);
            const flux=Math.max(0,Number(motion.flux)||0);
            const threshold=Math.max(.012,this.fluxMean+1.5*this.fluxDeviation);
            const accent=!!motion.accent,freshAccent=accent&&!this.lastAccent;
            // The dancer already uses log spectral flux with adjacent-bin max
            // suppression. Only fresh evidence can start a gesture; a level
            // held above a threshold is never permission to keep one alive.
            const onset=!gap&&this.silence===0&&now-this.lastOnset>140&&
                (freshAccent||(this.armed&&flux>threshold&&flux>this.previousFlux*1.05));
            this.lastAccent=accent;
            const prominence=clamp((flux-this.fluxMean)/Math.max(.018,2.5*this.fluxDeviation));
            const strength=clamp(.6*prominence+.25*lift+.15*layer);
            let rank=0,eventMedian=0;
            while(this.events.length&&now-this.events[0].time>12000)this.events.shift();
            if(onset){
                const interval=now-this.lastOnset;
                if(interval>=200&&interval<=1200){
                    this.intervals.push(interval);if(this.intervals.length>8)this.intervals.shift();
                    if(this.intervals.length>=3){
                        const p=median(this.intervals),error=median(this.intervals.map(v=>Math.abs(v-p)))/p;
                        this.confidence=clamp(1-error/.25);this.period=clamp(p,250,1000);
                    }
                }
                if(this.events.length){
                    // Ties receive half rank: the same drum hit repeated is
                    // not forever the most exceptional event in the song.
                    for(const e of this.events)rank+=strength>e.strength+.025?1:Math.abs(strength-e.strength)<=.025?.5:0;
                    rank/=this.events.length;eventMedian=median(this.events.map(e=>e.flux));
                }
                this.lastOnset=now;this.armed=false;
                this.excitement=Math.max(this.excitement,strength);
            }
            if(flux<threshold*.65)this.armed=true;
            this.fluxMean=follow(this.fluxMean,flux,1600);
            this.fluxDeviation=follow(this.fluxDeviation,Math.abs(flux-this.fluxMean),1600);
            this.previousFlux=flux;this.bed=follow(this.bed,energy,2400);
            if(now-this.lastOnset>this.period*2.5)this.confidence=follow(this.confidence,0,1500);
            // Onset spacing sizes an already triggered gesture. It cannot
            // generate one, predict a beat, or impose a repeating mode cycle.
            const unit=this.confidence>.55?this.period:500;
            this.excitement*=Math.exp(-dt/(unit*.7));
            const support=clamp(.35*lift+.2*bandRise+.15*layer+.3*this.excitement);
            this.tension=follow(this.tension,this.silence>100?0:support,180);
            let next=this.stage,reason=this.stage?'Playing a musical accent':'Single is home';
            let returned=false;
            if(this.stage&&(gap||now>=this.deadline||this.silence>120)){
                next=0;returned=true;reason=this.silence>120?'Single in silence':'Accent finished';
                // Single gets at least 2.2 times the elapsed accent duration.
                // This is a ceiling on visual busyness, not a quota or timer
                // that starts a pattern. Missed events are never queued.
                const duration=gap?0:Math.max(0,now-this.started);
                this.recoverAt=now+Math.max(750,duration*2.2);
                if(this.stage===2)this.crossRecoverAt=now+Math.max(2500,duration*8);
                this.started=this.deadline=null;
            }
            if(!returned&&next===0&&onset&&now>=this.recoverAt){
                const eligible=strength>=.36&&(this.events.length<4||rank>=.5);
                // Full-field accents need a standout attack plus a changing
                // arrangement. Loudness alone, or identical repeated hits,
                // cannot keep selecting Crossflow.
                const standout=this.events.length>=4&&rank>=.82&&strength>=.7&&
                    flux>Math.max(.025,eventMedian*1.35)&&prominence>.65&&(lift>.35||layer>.35);
                if(eligible){
                    next=standout&&now>=this.crossRecoverAt?2:1;
                    const duration=next===2?clamp(unit*(.85+.35*strength),450,980):clamp(unit*(.65+.4*strength),340,780);
                    this.started=now;this.deadline=now+duration;
                    reason=next===2?'Standout musical accent':'Musical accent';
                }
            }
            if(onset){this.events.push({time:now,strength,flux});if(this.events.length>64)this.events.shift();}
            const changed=next!==this.stage;
            if(changed){
                const from=modes[this.stage];this.stage=next;
                this.trace.push({time:Math.round(now),from,to:modes[next],reason,strength:+strength.toFixed(3)});
                if(this.trace.length>384)this.trace.shift();
            }
            this.expansion=this.stage===0?0:follow(this.expansion,this.stage,100);
            this.pressure=this.tension;
            this.snapshot={mode:modes[this.stage],expansion:this.expansion,changed,reason,drive:support,
                rise:lift,fall,energyChange:level,dynamics:lift-fall,tension:this.tension,onset,
                period:unit,confidence:this.confidence,layer,strength,rank,deadline:this.deadline};
            return this.snapshot;
        }
    }
    root.RainAudioFlow=RainAudioFlow;
    if(typeof module==='object'&&module.exports)module.exports=RainAudioFlow;
})(typeof window==='object'?window:globalThis);
