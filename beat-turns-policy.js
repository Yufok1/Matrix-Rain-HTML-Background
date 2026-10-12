// Beat turns steers on real attacks. Off waits for a sustained new layer.
// This wraps the accepted controller; it never touches geometry or colors.
(function(root){
    'use strict';
    const Base=root.RainAudioChoreography||(typeof module==='object'?require('./rain-audio-choreography.js'):null);
    const opposites={toward:'away',away:'toward',down:'up',up:'down',left:'right',right:'left'};
    const six=['toward','down','left','away','up','right'],four=['down','left','up','right'];
    const wrap=Parent=>class BeatTurnPolicy extends Parent {
        reset(){super.reset();this.turnProposal=null;this.beatMode=null;this.policyDepth=null;}
        support(proposal,values){
            let sum=0,evidence=0;for(const v of values)sum+=v;
            for(let i=0;i<64;i++){
                if(Math.min(proposal.choices.length-1,Math.floor(i*proposal.choices.length/64))!==proposal.region)continue;
                const ref=proposal.reference;
                const before=Math.max(ref[i],ref[Math.max(0,i-1)],ref[Math.min(63,i+1)]);
                const value=proposal.normalized?values[i]/Math.max(sum,.001):values[i];
                evidence+=Math.max(0,value-before);
            }
            return evidence;
        }
        update(spectrum,now,current,depth=true,beatTurns=false){
            if(this.sampledAt===null||now-this.sampledAt>250||this.policyDepth!==depth||this.beatMode!==beatTurns)this.turnProposal=null;
            this.beatMode=beatTurns;this.policyDepth=depth;
            if(beatTurns)return super.update(spectrum,now,current,depth,true);
            const heading=!depth&&['toward','away'].includes(current)?'down':current;
            const saved={lastTurn:this.lastTurn,lastReverse:this.lastReverse,turns:this.turnCount};
            const previous=this.previous.slice();
            let anchorShape=this.anchorShape?.slice();
            if(!anchorShape){let sum=0;for(const v of this.anchor)sum+=v;anchorShape=Float32Array.from(this.anchor,v=>v/Math.max(sum,.001));}
            const out=super.update(spectrum,now,current,depth,false);
            if(out.direction!==heading){
                const entry=this.trace.at(-1),choices=depth?six:four;
                const proposal={direction:out.direction,time:now,region:choices.indexOf(out.direction),choices,
                    normalized:entry.reason==='texture turn',reference:entry.reason==='texture turn'?anchorShape:previous};
                proposal.initial=this.support(proposal,this.previous);
                if(!this.turnProposal||this.turnProposal.direction!==proposal.direction)this.turnProposal=proposal;
                this.lastTurn=saved.lastTurn;this.lastReverse=saved.lastReverse;this.turnCount=saved.turns;
                entry.to=heading;entry.reason='awaiting sustained change';
                out.direction=heading;out.turns=this.turnCount;out.reason=entry.reason;
            }
            const proposal=this.turnProposal;
            if(proposal){
                if(proposal.initial<=1e-7||this.support(proposal,this.previous)<proposal.initial*.55)this.turnProposal=null;
                else if(now-proposal.time>=220){
                    const reversal=proposal.direction===opposites[heading];
                    const blocked=reversal&&(now-this.lastTurn<280||now-this.lastReverse<1400);
                    if(proposal.direction!==heading&&!blocked&&now-this.lastTurn>=170){
                        this.lastTurn=now;if(reversal)this.lastReverse=now;this.turnCount++;
                        out.direction=proposal.direction;out.turns=this.turnCount;out.reason='sustained texture turn';
                        this.trace.push({time:Math.round(now),from:heading,to:proposal.direction,reason:out.reason,region:proposal.region});
                        if(this.trace.length>240)this.trace.shift();this.turnProposal=null;
                    }
                }
            }
            this.snapshot=out;return out;
        }
    };
    const BeatTurnChoreography=wrap(Base);
    root.RainAudioChoreography=BeatTurnChoreography;
    const Original=root.RainAudioMotion||(typeof module==='object'?require('./rain-audio-motion.js'):null);
    root.RainAudioMotion=wrap(Original);
    root.addEventListener?.('DOMContentLoaded',()=>{
        const button=document.getElementById('toggleAudioReverseBtn');
        button.title='On: musical attacks can turn immediately. Off: a new layer must persist before turning. Speed still responds to accents.';
        const status=document.createElement('small');status.id='beatTurnPolicyStatus';
        status.style.cssText='display:block;color:#aaa;font-size:12px;margin:7px 0 10px';
        status.textContent='Off: turns follow sustained changes';
        button.parentElement.after(status);button.setAttribute('aria-pressed','false');
    });
    if(typeof module==='object'&&module.exports){module.exports=BeatTurnChoreography;module.exports.Original=root.RainAudioMotion;}
})(typeof window==='object'?window:globalThis);
