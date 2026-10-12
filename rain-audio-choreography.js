// Isolated audio-motion experiment. All turns require a change in the input.
// Fast/slow band envelopes are inspired by MilkDrop's immediate/attenuated
// levels; this is original steering code, not a MilkDrop preset interpreter.
(function (root) {
    'use strict';
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const headings = ['toward', 'down', 'left', 'away', 'up', 'right'];
    const planar = ['down', 'left', 'up', 'right'];
    const opposite = {toward:'away', away:'toward', down:'up', up:'down', left:'right', right:'left'};
    class RainAudioChoreography {
        constructor() { this.reset(); }
        reset() {
            this.previous = new Float32Array(64);
            this.anchor = new Float32Array(64);
            this.anchorShape = new Float32Array(64);
            this.mean = new Float32Array(64);
            this.bandFast = new Float32Array(6);
            this.bandSlow = new Float32Array(6);
            this.steering = new Float32Array(6);
            this.depth = null;
            this.sampledAt = null;
            this.lastEvent = this.lastTurn = this.lastReverse = -Infinity;
            this.fluxMean = this.fluxDeviation = this.previousFlux = this.fluxPeak = 0;
            this.fastEnergy = this.slowEnergy = 0;
            this.energyPeak = .08;
            this.impulse = 0;
            this.armed = true;
            this.speed = 35;
            this.eventCount = this.turnCount = 0;
            this.trace = [];
            this.snapshot = {direction:'down', speed:35, reason:'waiting', accent:false};
        }
        update(spectrum, now, current, depth=true, beatTurns=false) {
            const gap = this.sampledAt !== null && now-this.sampledAt > 250;
            const first = this.sampledAt === null || gap;
            const dt = first ? 1000/30 : clamp(now-this.sampledAt, 1, 100);
            this.sampledAt = now;
            if (this.depth!==depth || first) this.steering.fill(0);
            this.depth=depth;
            const follow = (a,b,ms) => a+(b-a)*(1-Math.exp(-dt/ms));
            const values = new Float32Array(64), shape = new Float32Array(64);
            const bands = new Float32Array(6), counts = new Uint8Array(6);
            let sum=0, previousSum=0, maximum=0;
            for (let i=0;i<64;i++) {
                const raw=clamp(Number(spectrum[i]) || 0,0,1);
                maximum=Math.max(maximum,raw);
                values[i]=Math.log1p(24*raw);
                sum+=values[i]; previousSum+=this.previous[i];
                const b=Math.min(5,Math.floor(i*6/64));
                bands[b]+=values[i]; counts[b]++;
            }
            const audible=maximum>=.002;
            const energy=sum/64;
            let flux=0, texture=0;
            for (let i=0;i<64;i++) {
                shape[i]=values[i]/Math.max(sum,.001);
                const neighbor=Math.max(this.previous[i],this.previous[Math.max(0,i-1)],this.previous[Math.min(63,i+1)]);
                const anchorNeighbor=Math.max(this.anchorShape[i],this.anchorShape[Math.max(0,i-1)],this.anchorShape[Math.min(63,i+1)]);
                flux+=Math.max(0,values[i]-neighbor);
                texture+=Math.max(0,shape[i]-anchorNeighbor);
            }
            flux/=Math.max(3,sum,previousSum);
            for (let b=0;b<6;b++) {
                bands[b]/=counts[b];
                if (first) this.bandFast[b]=this.bandSlow[b]=bands[b];
                this.bandFast[b]=follow(this.bandFast[b],bands[b],bands[b]>this.bandFast[b] ? 25 : 100);
                this.bandSlow[b]=follow(this.bandSlow[b],bands[b],2400);
                this.steering[b]*=Math.exp(-dt/75);
            }
            if (first) {
                this.fastEnergy=this.slowEnergy=energy;
                this.previous.set(values); this.anchor.set(values);
                this.anchorShape.set(shape); this.mean.set(values);
                this.impulse=0; this.armed=true; this.previousFlux=0;
            }
            this.fastEnergy=follow(this.fastEnergy,energy,energy>this.fastEnergy ? 25 : 110);
            this.slowEnergy=follow(this.slowEnergy,energy,1400);
            this.energyPeak=Math.max(.08,this.fastEnergy,this.energyPeak*Math.exp(-dt/5000));
            this.impulse*=Math.exp(-dt/190);
            const threshold=clamp(this.fluxMean*.7+this.fluxDeviation*.85,.016,.14)*(beatTurns ? .8 : 1);
            const onset=!first && audible && this.armed && flux>threshold && flux>this.previousFlux*1.04;
            // Shape is normalized: a held note getting quieter is not a new
            // heading. Removing one layer while another carries on can be.
            const changed=!first && audible && texture>.16;
            const event=(onset || changed) && now-this.lastEvent>=(beatTurns ? 95 : 140);
            let direction=!depth && ['toward','away'].includes(current) ? 'down' : current;
            let reason=audible ? 'carry' : 'quiet', winner=-1;
            if (event) {
                const scores=new Float32Array(depth ? 6 : 4);
                const choices=depth ? headings : planar;
                const reference=onset ? this.previous : this.anchor;
                for (let i=0;i<64;i++) {
                    const before=Math.max(reference[i],reference[Math.max(0,i-1)],reference[Math.min(63,i+1)]);
                    const anchorNeighbor=Math.max(this.anchorShape[i],this.anchorShape[Math.max(0,i-1)],this.anchorShape[Math.min(63,i+1)]);
                    const fresh=Math.max(0,values[i]-before);
                    const redistribution=Math.max(0,shape[i]-anchorNeighbor)*sum;
                    // Relative novelty gives a newly arriving quieter voice a
                    // chance beside a loud, already established bass line.
                    const weight=Math.pow(onset ? fresh : redistribution,1.5)/Math.sqrt(.075+this.mean[i]);
                    scores[Math.min(choices.length-1,Math.floor(i*choices.length/64))]+=weight;
                }
                let best=0, total=0, evidence=0;
                for (let b=0;b<scores.length;b++) {
                    this.steering[b]=Math.max(scores[b],this.steering[b]);
                    total+=scores[b];
                    evidence+=this.steering[b];
                    if (this.steering[b]>this.steering[best]) best=b;
                }
                const currentIndex=choices.indexOf(direction);
                // Prefer a real active region over the empty midpoint between
                // simultaneous bass and treble. Near ties keep the path.
                if (currentIndex>=0 && this.steering[currentIndex]>=this.steering[best]*.78) best=currentIndex;
                winner=best;
                // Diffuse background energy becoming relatively louder after
                // a note ends is not evidence for a particular new heading.
                const distinct=this.steering[best]/Math.max(evidence,1e-6)>(depth ? .24 : .32);
                const candidate=total>1e-6 && distinct ? choices[best] : direction;
                const reversal=candidate===opposite[direction];
                const blocked=reversal && (now-this.lastTurn<280 || now-this.lastReverse<1400);
                const before=direction;
                if (candidate!==direction && !blocked && now-this.lastTurn>=(beatTurns ? 110 : 170)) {
                    direction=candidate; this.lastTurn=now; this.turnCount++;
                    if (reversal) this.lastReverse=now;
                    reason=onset ? 'new voice turn' : 'texture turn';
                } else reason=blocked ? 'backtrack restrained' : 'accent on path';
                // An accent drives propulsion independently of whether it wins
                // steering. Repeated percussion continues to pulse in place.
                let relativeAttack=0;
                for (let b=0;b<6;b++) relativeAttack=Math.max(relativeAttack,(bands[b]-this.bandSlow[b])/Math.max(.075,this.bandSlow[b]));
                if (onset) this.impulse=Math.max(this.impulse,clamp(.28+.22*Math.sqrt(Math.max(0,relativeAttack))+.12*flux/Math.max(.03,threshold),.28,1));
                this.eventCount++; this.lastEvent=now; this.armed=false;
                this.fluxPeak=Math.max(flux,threshold);
                this.anchor.set(values); this.anchorShape.set(shape);
                this.trace.push({time:Math.round(now),from:before,to:direction,reason,flux:+flux.toFixed(4),texture:+texture.toFixed(4),region:best});
                if(this.trace.length>240) this.trace.shift();
            }
            if (flux<Math.max(threshold*.7,this.fluxPeak*.55)) this.armed=true;
            this.fluxMean=follow(this.fluxMean,flux,1200);
            this.fluxDeviation=follow(this.fluxDeviation,Math.abs(flux-this.fluxMean),1200);
            this.previousFlux=flux; this.previous.set(values);
            for(let i=0;i<64;i++) this.mean[i]=follow(this.mean[i],values[i],2400);
            const activity=clamp(this.fastEnergy/this.energyPeak,0,1);
            // Each region contributes its own rising envelope. A strong bass
            // bed cannot erase a smaller mid/high accent from propulsion.
            let lift=0;
            for(let b=0;b<6;b++) lift=Math.max(lift,(this.bandFast[b]-this.bandSlow[b])/Math.max(.075,this.bandSlow[b]));
            lift=clamp(lift*.22,0,.65);
            const target=clamp(72-activity*28-lift*15-this.impulse*27,15,85);
            this.speed=follow(this.speed,target,target<this.speed ? 22 : 135);
            this.snapshot={direction,speed:Math.round(this.speed),reason,accent:event,flux,texture,activity,impulse:this.impulse,events:this.eventCount,turns:this.turnCount,region:winner};
            return this.snapshot;
        }
    }
    root.RainAudioChoreography=RainAudioChoreography;
    if (typeof module==='object' && module.exports) module.exports=RainAudioChoreography;
})(typeof window==='object' ? window : globalThis);
