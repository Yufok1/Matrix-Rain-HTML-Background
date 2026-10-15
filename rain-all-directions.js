// Crossflow splits the existing stream population evenly among axes.
// Density is shared, with one stream minimum per axis; no extra clocks or sources.
(function(root){
    'use strict';
    const vectors={down:[0,1,0],up:[0,-1,0],right:[1,0,0],left:[-1,0,0],away:[0,0,1],toward:[0,0,-1]};
    const names=new Map(Object.entries(vectors).map(([name,v])=>[v.join(','),name]));
    const state=root.rainAllDirections={enabled:true};
    try{const saved=localStorage.getItem('matrixRain.flow');if(saved==='directed'||saved==='crossflow')state.enabled=saved==='crossflow';}catch{}
    let order=null,ranks=null;
    state.directionFor=function(index,depth=true){
        if(!this.enabled)return null;
        // Density enables a prefix of columnOrder. Assign by that stable rank
        // so even a sparse population stays evenly divided between directions.
        const current=root.columnOrder;
        if(current!==order){order=current;ranks=null;if(current){ranks=new Int32Array(current.length);current.forEach((column,rank)=>ranks[column]=rank);}}
        const rank=ranks&&index>=0&&index<ranks.length?ranks[index]:index;
        const cohort=depth?['down','right','away','up','left','toward']:['down','right','up','left'];
        const [x,y,z]=vectors[cohort[((rank%cohort.length)+cohort.length)%cohort.length]];
        const heading=typeof MatrixRainEngine==='undefined'?'down':MatrixRainEngine.rainConfig.direction;
        // A proper shared rotation follows the existing conductor. Its six
        // headings stay populated together; turns are driven by the same audio
        // events as before, never by a new timer or random direction selector.
        let v=[x,y,z];
        if(heading==='up')v=[-x,-y,z];
        else if(heading==='left')v=[-y,x,z];
        else if(heading==='right')v=[y,-x,z];
        else if(depth&&heading==='away')v=[x,-z,y];
        else if(depth&&heading==='toward')v=[x,z,-y];
        return names.get(v.map(n=>n||0).join(','));
    };
    state.setEnabled=function(value){
        if(this.enabled===!!value)return;
        this.enabled=!!value;
        try{localStorage.setItem('matrixRain.flow',this.enabled?'crossflow':'directed');}catch{}
        // Use the existing turn joint: discard only the pending head step.
        // Keep immutable history and unwrapped stream coordinates intact.
        if(typeof rainMotion!=='undefined')rainMotion.direction='crossflow-transition';
        if(typeof recomputeActiveColumnsMask==='function')recomputeActiveColumnsMask();
        this.refresh?.();
    };
    state.mount=function(parent){
        const panel=document.createElement('div');panel.id='rain-all-directions';
        panel.innerHTML='<strong>Flow pattern</strong><div class="settings-row"><button id="all-directions-on" type="button">Crossflow · all directions</button><button id="all-directions-off" type="button">Single direction</button></div><p id="all-directions-status" class="settings-hint"></p><p class="settings-hint">Density is shared, with at least one stream per direction. This choice is remembered and included in shared configurations.</p>';
        parent.append(panel);
        this.refresh=()=>{
            const depth=typeof rainCamera==='undefined'||rainCamera.enabled;
            panel.querySelector('#all-directions-on').setAttribute('aria-pressed',String(this.enabled));
            panel.querySelector('#all-directions-off').setAttribute('aria-pressed',String(!this.enabled));
            panel.querySelector('#all-directions-status').textContent=this.enabled?(depth?'Left, right, up, down, toward and away — together.':'Left, right, up and down — together in flat view.'):'Original shared direction.';
        };
        panel.querySelector('#all-directions-on').onclick=()=>this.setEnabled(true);
        panel.querySelector('#all-directions-off').onclick=()=>this.setEnabled(false);
        this.refresh();
    };
})(typeof window==='undefined'?globalThis:window);
