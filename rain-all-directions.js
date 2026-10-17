// Single direction, Crossflow and the selected Counterflow keeper. One population, one motion clock, immutable history.
(function(root){
    'use strict';
    const vectors={down:[0,1,0],up:[0,-1,0],right:[1,0,0],left:[-1,0,0],away:[0,0,1],toward:[0,0,-1]};
    const names=new Map(Object.entries(vectors).map(([name,v])=>[v.join(','),name]));
    const opposite={down:'up',up:'down',left:'right',right:'left',away:'toward',toward:'away'};
    const modes=['directed','counterflow','crossflow'];
    const labels=['Single direction','Counterflow','Crossflow · all directions'];
    const notes={directed:'Original shared direction.',crossflow:'All six headings together; four in flat view.',
        counterflow:'Two opposing currents. The existing conductor steers both lanes.'};
    const state=root.rainAllDirections={mode:'directed',manualMode:'directed',
        frame:0,depth:true,axesDepth:true,records:new Map(),forks:new Map(),lastFrame:-1,serial:0};
    Object.defineProperty(state,'enabled',{get(){return this.mode!=='directed';}});
    Object.defineProperty(state,'independentTurns',{get(){return this.mode==='counterflow'||this.transitioning;}});
    try{
        const saved=localStorage.getItem('matrixRain.flow')??localStorage.getItem('matrixRain.angularFlow');
        if(modes.includes(saved))state.mode=state.manualMode=saved;
        // Retire old automatic preferences while preserving the manual pattern.
        localStorage.removeItem?.('matrixRain.flowFollowMusic');
        localStorage.removeItem?.('matrixRain.flowFollowMusic.optIn');
    }catch{}
    let order=null,ranks=null;
    function rankFor(index){
        const current=root.columnOrder;
        if(current!==order){order=current;ranks=null;if(current){ranks=new Int32Array(current.length);current.forEach((column,rank)=>ranks[column]=rank);}}
        return ranks&&index>=0&&index<ranks.length?ranks[index]:index;
    }
    function heading(){return typeof MatrixRainEngine==='undefined'?'down':MatrixRainEngine.rainConfig.direction;}
    function axisDepth(depth){
        // Projection remains in the same world while its legal future headings
        // become planar. Existing Z segments can finish before Auto flattens it.
        if(root.rainAutoScenes?.preparingFlat)return false;
        if(root.audioReactiveActive&&typeof rainCamera!=='undefined'&&!rainCamera.enabled)return false;
        return depth;
    }
    function rotate(name,h,depth){
        const [x,y,z]=vectors[name];let v=[x,y,z];
        if(h==='up')v=[-x,-y,z];else if(h==='left')v=[-y,x,z];else if(h==='right')v=[y,-x,z];
        else if(depth&&h==='away')v=[x,-z,y];else if(depth&&h==='toward')v=[x,z,-y];
        return names.get(v.map(n=>n||0).join(','));
    }
    function perpendicular(from,depth,seed){
        const choices=(depth?['down','right','away','up','left','toward']:['down','right','up','left']).filter(n=>n!==from&&n!==opposite[from]);
        return choices[((seed%choices.length)+choices.length)%choices.length];
    }
    function record(index){
        let r=state.records.get(index);
        if(!r){r={rank:rankFor(index),unit:0,last:null,hold:0,conductor:heading()};state.records.set(index,r);}
        return r;
    }
    state.beginFrame=function(frame){
        const depth=typeof rainCamera==='undefined'?true:(rainCamera.active ?? rainCamera.enabled);
        if(frame<this.lastFrame||depth!==this.depth){this.records.clear();this.clearForks();this.transitioning=false;}
        this.frame=Number.isFinite(frame)?frame:this.frame+1;this.lastFrame=this.frame;this.depth=depth;
        this.axesDepth=axisDepth(depth);
        if(this.transitioning&&root.activeColumnsMask){
            // A density reduction retires heads. They cannot finish a pending
            // turn, so they must not keep the entire scene waiting forever.
            for(const [index,r] of this.records)if(!root.activeColumnsMask[index])r.transition=false;
            this.transitioning=[...this.records.values()].some(r=>r.transition);
        }
    };
    state.directionFor=function(index,depth=true){
        if(!this.enabled)return null;
        depth=axisDepth(depth);
        const rank=rankFor(index),h=heading();
        if(this.mode==='crossflow'){
            const cohort=depth?['down','right','away','up','left','toward']:['down','right','up','left'];
            return rotate(cohort[((rank%cohort.length)+cohort.length)%cohort.length],h,depth);
        }
        return rotate(rank%2?'up':'down',h,depth);
    };
    state.planStep=function(index,depth,fontSize,speed){
        depth=axisDepth(depth);
        let r=this.records.get(index);
        if(this.mode!=='counterflow'&&!r?.transition)return null;
        r=r||record(index);
        const conductor=heading(),liveDesired=this.directionFor(index,depth)||conductor;
        const beatTurn=root.audioReactiveActive&&typeof audioReverseEnabled!=='undefined'&&audioReverseEnabled
            &&r.conductor!==conductor;
        r.conductor=conductor;
        if(beatTurn){
            // A newly accepted beat turn owns the next ordinary glyph step.
            // Do not finish an older stagger or detour before acknowledging it.
            r.delay=r.hold=0;delete r.distanceKey;
            if(r.transition)r.target=liveDesired;
        }
        // Complete the chosen handoff even if a new musical attack changes the
        // conductor mid-segment, unless Beat turns explicitly takes priority.
        const desired=(r.transition?r.target:null)||liveDesired;
        if(!r.unit)r.unit=fontSize;
        // An opposite request gets a real perpendicular segment, not a one-glyph
        // twitch. Reverse flow remains the user's explicit global reversal.
        let actual=r.last||desired;
        if(r.delay>0){r.distanceKey='delay';}
        else if(r.hold<=0){
            if(actual===opposite[desired]){actual=perpendicular(actual,depth,r.rank);r.hold=r.unit*6;}
            else actual=desired;
            if(r.transition&&!r.forked&&actual!==r.last){this.spawnFork(index,r.last,fontSize);r.forked=true;}
            if(actual===desired&&r.transition){
                r.transition=false;
                delete r.target;
                this.transitioning=[...this.records.values()].some(v=>v.transition);
            }
        }
        r.last=actual;
        const finite=Number.isFinite(speed)?Math.max(0,speed):0;
        let distance=fontSize*finite;
        if(r.delay>0)distance=Math.min(distance,r.delay);
        else if(r.hold>0)distance=Math.min(distance,r.hold);
        return {direction:actual,speed:distance/fontSize};
    };
    state.afterStep=function(index,fontSize,speed){
        const r=this.records.get(index);if(!r)return;
        if(r.distanceKey==='delay'){r.delay=Math.max(0,r.delay-Math.max(0,fontSize*speed));r.distanceKey=null;}
        else if(r.hold>0)r.hold=Math.max(0,r.hold-Math.max(0,fontSize*speed));
        const fork=this.forks.get(index);if(fork){
            this.advanceFork(fork,fontSize,speed);fork.remaining-=Math.max(0,speed);
            if(fork.remaining<=0)this.removeFork(index);
        }
    };
    state.removeFork=function(index){
        const fork=this.forks.get(index);if(!fork)return;
        if(typeof rainCamera!=='undefined')rainCamera.streams.delete(fork.id);
        this.forks.delete(index);
    };
    state.clearForks=function(){for(const index of this.forks.keys())this.removeFork(index);};
    state.spawnFork=function(index,direction,fontSize){
        if(typeof rainMotion==='undefined'||!vectors[direction])return;
        const p=rainMotion.drops[index];if(!p)return;
        this.removeFork(index);
        const fork={id:'flow-fork-'+(++this.serial),direction,remaining:10,head:{...p,sourceId:index,lastStamp:null},fontSize};
        this.forks.set(index,fork);
        if(typeof rainCamera!=='undefined'){
            const stream=rainCamera.streams.get(index);
            if(stream)rainCamera.streams.set(fork.id,{...stream,raw:{...stream.raw},delta:[...stream.delta]});
        }
    };
    state.advanceFork=function(fork,fontSize,speed){
        const p=fork.head,d=fork.direction,depth=this.depth;
        const reverse=typeof reverseFlowMultiplier==='undefined'?1:reverseFlowMultiplier;
        const focal=500,scale=depth?focal/p.depth:1,cx=matrixCanvas.width/2,cy=matrixCanvas.height/2;
        p.lastStepDirection=d;
        if(depth&&(d==='toward'||d==='away')){
            const near=focal/8,span=focal/.25-near;
            p.depth=near+((p.depth+fontSize*speed*reverse*(d==='away'?1:-1)-near)%span+span)%span;
            const ratio=(focal/p.depth)/scale;p.x=cx+(p.x-cx)*ratio;p.y=cy+(p.y-cy)*ratio;
        }else{
            const v=vectors[d],step=fontSize*scale*speed*reverse,pad=fontSize*8;
            const wrap=(n,span)=>((n+pad)%(span+pad*2)+span+pad*2)%(span+pad*2)-pad;
            if(v[0])p.x=wrap(p.x+v[0]*step,matrixCanvas.width);
            if(v[1])p.y=wrap(p.y+v[1]*step,matrixCanvas.height);
        }
    };
    state.paintFork=function(index,char,fontSize,alpha,color){
        const fork=this.forks.get(index);if(!fork)return;
        const p=fork.head,opacity=alpha*Math.min(1,Math.ceil(fork.remaining/2)/4);
        if(this.depth&&typeof rainCamera!=='undefined')rainCamera.capture(char,p.x,p.y,p.depth,fontSize,opacity,color,fork.id,p);
        if(!this.depth||rainCameraGPU.failed||rainCameraGPU.lost){
            const savedAlpha=matrixCtx.globalAlpha,savedFont=matrixCtx.font;
            matrixCtx.globalAlpha=opacity;matrixCtx.font=`${fontSize*(this.depth?500/p.depth:1)}px monospace`;
            matrixCtx.fillText(char,p.x,p.y);matrixCtx.globalAlpha=savedAlpha;matrixCtx.font=savedFont;
        }
    };
    state.applyMode=function(mode,organic=false){
        if(!modes.includes(mode)||this.mode===mode)return;
        this.mode=mode;this.records.clear();
        this.transitioning=false;
        if(organic&&typeof rainMotion!=='undefined'){
            for(let i=0;i<rainMotion.drops.length;i++){
                if(root.activeColumnsMask&&!root.activeColumnsMask[i])continue;
                const p=rainMotion.drops[i];if(!p?.lastStepDirection)continue;
                const depth=typeof rainCamera==='undefined'?true:(rainCamera.active ?? rainCamera.enabled);
                const r=record(i);Object.assign(r,{last:p.lastStepDirection,target:this.directionFor(i,axisDepth(depth))||heading(),transition:true,forked:false,
                    delay:(r.rank%8)*((typeof MatrixRainEngine==='undefined'?10:MatrixRainEngine.rainConfig.fontSize)*.8)});
                this.transitioning=true;
            }
        }else{this.clearForks();if(typeof rainMotion!=='undefined')rainMotion.direction='angular-flow-transition';}
        if(typeof recomputeActiveColumnsMask==='function')recomputeActiveColumnsMask();
        this.refresh?.();
    };
    state.setMode=function(mode){
        if(!modes.includes(mode))return;
        this.manualMode=mode;try{localStorage.setItem('matrixRain.flow',mode);}catch{}
        this.applyMode(mode);this.refresh?.();
    };
    state.setEnabled=function(value){this.setMode(value?'crossflow':'directed');};
    state.mount=function(parent){
        const panel=document.createElement('div');panel.id='rain-all-directions';
        panel.innerHTML='<strong>Flow pattern</strong><div class="settings-row" role="group" aria-label="Flow pattern">'+modes.map(mode=>`<button type="button" data-flow="${mode}"${mode==='directed'?' id="all-directions-off"':mode==='crossflow'?' id="all-directions-on"':''}>${labels[modes.indexOf(mode)]}</button>`).join('')+'</div><p id="all-directions-status" class="settings-hint" role="status"></p>';
        parent.append(panel);
        for(const b of panel.querySelectorAll('[data-flow]'))b.onclick=()=>this.setMode(b.dataset.flow);
        this.refresh=()=>{
            for(const b of panel.querySelectorAll('[data-flow]'))b.setAttribute('aria-pressed',String(b.dataset.flow===this.mode));
            panel.querySelector('#all-directions-status').textContent=notes[this.mode];
        };this.refresh();
    };
})(typeof window==='undefined'?globalThis:window);
