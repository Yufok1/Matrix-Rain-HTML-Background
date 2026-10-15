// Causal musical bloom: attacks steer the existing fast dancer; formation
// follows accumulated lift, new layers and release on a longer time scale.
// Original lightweight implementation; see AUDIO-BLOOM-RESEARCH.md for sources.
(function(root){
    'use strict';
    const modes=['directed','counterflow','crossflow'];
    const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
    const median=a=>{const s=a.slice().sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
    class RainAudioFlow {
        constructor(){this.reset();}
        reset(mode='directed'){
            this.stage=Math.max(0,modes.indexOf(mode));this.expansion=this.stage;
            this.at=null;this.trace=[];this.silence=0;this.engaged=false;
            this.body=this.bed=this.deviation=0;this.bands=new Float32Array(6);
            this.fluxMean=this.fluxDeviation=this.previousFlux=0;this.armed=true;
            this.lastOnset=-Infinity;this.intervals=[];this.period=500;this.confidence=0;
            this.excitement=this.tension=this.up=this.down=0;this.entered=-Infinity;
            this.snapshot={mode:modes[this.stage],expansion:this.expansion,changed:false,drive:0,reason:'Listening for musical development'};
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
                this.body=this.bed=energy;this.deviation=0;this.armed=true;
                this.fluxMean=this.fluxDeviation=this.previousFlux=0;
                this.excitement=this.up=this.down=0;this.engaged=false;
                this.lastOnset=-Infinity;this.intervals=[];this.confidence=0;
                for(let i=0;i<6;i++)this.bands[i]=Math.max(0,Number(fast[i])||0);
            }
            this.body=follow(this.body,energy,220);
            const level=Math.log((this.body+.035)/(this.bed+.035));
            this.deviation=follow(this.deviation,Math.abs(level),6000);
            const scale=Math.max(.018,this.deviation*2.4);
            const lift=clamp(level/scale),fall=clamp(-level/scale);
            for(let i=0;i<6;i++){
                const value=Math.max(0,Number(fast[i])||0);
                bandRise+=Math.max(0,Math.log((value+.035)/(this.bands[i]+.035)));
                if(!gap)shapeChange+=Math.abs(value/Math.max(total,.001)-this.bands[i]/Math.max(reference,.001));
                this.bands[i]=follow(this.bands[i],value,2200);
            }
            bandRise=clamp(bandRise/(6*scale));
            const layer=clamp(shapeChange/.22);
            const flux=Math.max(0,Number(motion.flux)||0);
            const threshold=Math.max(.002,this.fluxMean+1.6*this.fluxDeviation);
            // A causal adaptive onset gate, with rearming below its local floor.
            // No future samples, predicted beats or playback delay are needed.
            const onset=!gap&&this.silence===0&&now-this.lastOnset>120&&
                (!!motion.accent||(this.armed&&flux>threshold&&flux>this.previousFlux*1.05));
            if(onset){
                const interval=now-this.lastOnset;
                if(interval>=200&&interval<=1200){
                    this.intervals.push(interval);if(this.intervals.length>8)this.intervals.shift();
                    if(this.intervals.length>=3){
                        const p=median(this.intervals),error=median(this.intervals.map(v=>Math.abs(v-p)))/p;
                        this.confidence=clamp(1-error/.25);this.period=clamp(p,250,1000);
                    }
                }
                this.lastOnset=now;this.armed=false;this.engaged=true;
                const strength=clamp(.35+.25*Math.max(0,flux/threshold-1)+.25*(motion.impulse||0)+.15*lift);
                this.excitement=Math.max(this.excitement,strength);
            }
            if(flux<threshold*.65)this.armed=true;
            this.fluxMean=follow(this.fluxMean,flux,1600);
            this.fluxDeviation=follow(this.fluxDeviation,Math.abs(flux-this.fluxMean),1600);
            this.previousFlux=flux;this.bed=follow(this.bed,energy,3200);
            if(Math.abs(level)>.012||layer>.06)this.engaged=true;
            // Pulse spacing only scales how a movement settles. It never emits
            // an event or schedules a pattern, and uncertain timing falls back.
            const unit=this.confidence>.55?this.period:500;
            this.excitement*=Math.exp(-dt/(unit*1.1));
            const support=clamp(.52*lift+.26*bandRise+.20*layer+.45*this.excitement);
            this.tension=follow(this.tension,this.silence>100?0:support,support>this.tension?220:650);
            if(now-this.lastOnset>this.period*2.5)this.confidence=follow(this.confidence,0,1500);
            const release=fall>.18||this.silence>100||this.tension<.22;
            const age=now-this.entered;
            // Evidence must accumulate; a beat can animate a held formation
            // without repeatedly replacing the entire spatial arrangement.
            const wantsUp=this.stage===0?this.tension>.42:this.tension>.64;
            this.up=wantsUp?this.up+dt:Math.max(0,this.up-dt*2);
            const wantsDown=this.stage===2?this.tension<.42:(release&&this.tension<.38);
            this.down=wantsDown?this.down+dt:Math.max(0,this.down-dt*2);
            let next=this.stage,reason='Carrying the musical gesture';
            if(this.engaged){
                if(this.stage<2&&this.up>=(this.stage===0?100:240)&&age>=unit*.9&&
                    (onset||lift>.28||layer>.4)){
                    next++;reason=next===1?'Opening into paired currents':'Blooming on accumulated musical lift';
                }else if(this.stage>0&&this.down>=unit*.75&&age>=unit*.8){
                    next--;reason=next===0?'Relaxing into one current':'Gathering from the bloom';
                }
            }
            if(this.silence>350){next=0;reason='Relaxing in silence';}
            const changed=next!==this.stage;
            if(changed){
                const from=modes[this.stage];this.stage=next;this.entered=now;this.up=this.down=0;
                this.trace.push({time:Math.round(now),from,to:modes[next],reason,tension:+this.tension.toFixed(3)});
                if(this.trace.length>384)this.trace.shift();
            }
            // Cohort identity is stable within a formation; this envelope can
            // breathe without assigning heads to a different axis every frame.
            if(this.stage===0)this.expansion=0;
            else this.expansion=follow(this.expansion,this.stage,this.stage>this.expansion?180:350);
            if(this.silence>450)this.expansion=0;
            this.pressure=this.tension;
            this.snapshot={mode:modes[this.stage],expansion:this.expansion,changed,reason,drive:support,
                rise:lift,fall,energyChange:level,dynamics:lift-fall,tension:this.tension,onset,
                period:unit,confidence:this.confidence,layer};
            return this.snapshot;
        }
    }
    root.RainAudioFlow=RainAudioFlow;
    if(typeof module==='object'&&module.exports)module.exports=RainAudioFlow;
})(typeof window==='object'?window:globalThis);
