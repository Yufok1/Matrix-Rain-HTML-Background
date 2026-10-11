// Musical motion uses the existing spectrum feed; it never captures audio.
(function (root) {
    'use strict';
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const headings = ['toward', 'down', 'left', 'away', 'up', 'right'];
    const planar = ['down', 'left', 'up', 'right'];
    const opposites = {toward:'away', away:'toward', down:'up', up:'down', left:'right', right:'left'};
    class RainAudioMotion {
        constructor() { this.reset(); }
        reset() {
            this.previous = new Float32Array(64);
            this.anchor = new Float32Array(64);
            this.sampledAt = null;
            this.lastEvent = -Infinity;
            this.lastTurn = -Infinity;
            this.lastReverse = -Infinity;
            this.fluxMean = 0;
            this.fluxDeviation = 0;
            this.previousFlux = 0;
            this.fluxPeak = 0;
            this.armed = true;
            this.fastEnergy = 0;
            this.slowEnergy = 0;
            this.energyPeak = 0.08;
            this.impulse = 0;
            this.speed = 35;
            this.eventCount = 0;
            this.turnCount = 0;
            this.trace = [];
            this.snapshot = {direction:'down', speed:35, reason:'waiting', accent:false};
        }
        static wallpaperSpectrum(stereo) {
            const mono = new Float32Array(64);
            for (let i=0;i<64;i++) {
                mono[i]=(clamp(Number(stereo[i]) || 0,0,1)+clamp(Number(stereo[i+64]) || 0,0,1))/2;
            }
            return mono;
        }
        static browserSpectrum(bytes, hzPerBin) {
            const mono = new Float32Array(64);
            for (let i=0;i<64;i++) {
                const low=20*Math.pow(800,i/64), high=20*Math.pow(800,(i+1)/64);
                const from=Math.max(1,Math.floor(low/hzPerBin));
                const to=Math.min(bytes.length,Math.max(from+1,Math.ceil(high/hzPerBin)));
                let sum=0;
                for(let bin=from;bin<to;bin++) sum+=bytes[bin]/255;
                mono[i]=to>from ? sum/(to-from) : 0;
            }
            return mono;
        }
        update(spectrum, now, current, depthEnabled=true, beatTurns=false) {
            const first=this.sampledAt===null;
            const dt=first ? 33 : clamp(now-this.sampledAt,1,100);
            this.sampledAt=now;
            const values=new Float32Array(64);
            let sum=0, previousSum=0, anchorSum=0, maximum=0;
            for(let i=0;i<64;i++) {
                const raw=clamp(Number(spectrum[i]) || 0,0,1);
                maximum=Math.max(maximum,raw);
                values[i]=Math.log1p(24*raw);
                sum+=values[i];previousSum+=this.previous[i];anchorSum+=this.anchor[i];
            }
            const energy=sum/64;
            const follow=(from,to,time)=>from+(to-from)*(1-Math.exp(-dt/time));
            this.fastEnergy=follow(this.fastEnergy,energy,energy>this.fastEnergy ? 25 : 95);
            this.slowEnergy=follow(this.slowEnergy,energy,1000);
            this.energyPeak=Math.max(0.08,this.fastEnergy,this.energyPeak*Math.exp(-dt/4500));
            this.impulse*=Math.exp(-dt/160);
            let direction=!depthEnabled && (current==='toward' || current==='away') ? 'down' : current;
            let flux=0, texture=0, noveltyWeight=0, position=0;
            for(let i=0;i<64;i++) {
                // Neighbor matching suppresses small vibrato shifts as new attacks.
                const before=Math.max(this.previous[i],this.previous[Math.max(0,i-1)],this.previous[Math.min(63,i+1)]);
                const oldAnchor=Math.max(this.anchor[i],this.anchor[Math.max(0,i-1)],this.anchor[Math.min(63,i+1)]);
                const fresh=Math.max(0,values[i]-before);
                const changed=Math.max(0,values[i]-oldAnchor);
                flux+=fresh;texture+=changed;
            }
            flux/=Math.max(3,sum,previousSum);
            texture/=Math.max(3,sum,anchorSum);
            const audible=maximum>=0.002;
            const threshold=Math.max(0.016,Math.min(0.14,this.fluxMean*0.7+this.fluxDeviation*0.85))*(beatTurns ? 0.8 : 1);
            const onset=!first && audible && this.armed && flux>threshold && flux>this.previousFlux*1.04;
            const changingTexture=!first && audible && texture>0.18;
            const event=(onset || changingTexture) && now-this.lastEvent>=(beatTurns ? 95 : 140);
            let reason=audible ? 'carry' : 'quiet';
            if(first) {
                this.anchor.set(values);
            } else if(event) {
                for(let i=0;i<64;i++) {
                    const reference=onset ? this.previous : this.anchor;
                    const old=Math.max(reference[i],reference[Math.max(0,i-1)],reference[Math.min(63,i+1)]);
                    const weight=Math.pow(Math.max(0,values[i]-old),1.5);
                    noveltyWeight+=weight;position+=weight*(i+0.5)/64;
                }
                const center=noveltyWeight>0 ? position/noveltyWeight : 0.5;
                const choices=depthEnabled ? headings : planar;
                const index=Math.min(choices.length-1,Math.floor(center*choices.length));
                const candidate=choices[index];
                const reversal=candidate===opposites[direction];
                // Restrain short repeated retracing, without a permanent veto or
                // a forced perpendicular detour. A later audio event can reverse.
                const tooSoon=reversal && now-this.lastTurn<280;
                const repeated=reversal && now-this.lastReverse<1400;
                const reverseBlocked=tooSoon || repeated;
                const before=direction;
                if(candidate!==direction && !reverseBlocked) {
                    direction=candidate;this.lastTurn=now;this.turnCount++;
                    if(reversal) this.lastReverse=now;
                    reason=onset ? 'attack turn' : 'texture turn';
                } else reason=reverseBlocked ? 'backtrack restrained' : 'accent on path';
                this.eventCount++;
                this.lastEvent=now;
                this.armed=false;
                this.fluxPeak=Math.max(flux,threshold);
                this.impulse=Math.max(this.impulse,clamp(flux/Math.max(threshold,0.03)*0.3,0.2,1));
                this.anchor.set(values);
                this.trace.push({time:Math.round(now),from:before,to:direction,reason,flux:Number(flux.toFixed(4)),texture:Number(texture.toFixed(4)),center:Number(center.toFixed(4))});
                if(this.trace.length>240) this.trace.shift();
            }
            if(flux<Math.max(threshold*0.7,this.fluxPeak*0.55)) this.armed=true;
            this.fluxMean=follow(this.fluxMean,flux,1200);
            this.fluxDeviation=follow(this.fluxDeviation,Math.abs(flux-this.fluxMean),1200);
            this.previousFlux=flux;
            this.previous.set(values);
            // Travel follows sustained energy; accents add an immediate impulse
            // even when the next musical event keeps the same heading.
            const activity=clamp(this.fastEnergy/this.energyPeak,0,1);
            const lift=clamp((this.fastEnergy-this.slowEnergy)/this.energyPeak,0,0.5);
            const target=clamp(68-activity*26-lift*16-this.impulse*25,15,85);
            this.speed=follow(this.speed,target,target<this.speed ? 20 : 110);
            this.snapshot={direction,speed:Math.round(this.speed),reason,accent:event,flux,texture,activity,impulse:this.impulse,events:this.eventCount,turns:this.turnCount};
            return this.snapshot;
        }
    }
    root.RainAudioMotion=RainAudioMotion;
    if(typeof module==='object' && module.exports) module.exports=RainAudioMotion;
})(typeof window==='object' ? window : globalThis);
