// Random destinations, connected routes. Each step preserves the other visual
// families; this is deliberately not a playlist of authored scenes.
(function () {
    'use strict';
    const pick = values => values[Math.floor(Math.random()*values.length)];
    const integer = (a,b) => a + Math.floor(Math.random()*(b-a+1));
    const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
    const other = (values,current) => pick(values.filter(value=>value!==current));
    const opposite = {down:'up',up:'down',left:'right',right:'left',toward:'away',away:'toward'};
    const planar = ['down','right','up','left'];
    const axes = [...planar,'toward','away'];
    const el = id => document.getElementById(id);
    const state = window.rainAutoScenes = {queue:[],tweens:[],last:null,description:'',refreshTime:0,intervalSeconds:12};
    try { const saved=Number(localStorage.getItem('matrixRain.autoSceneInterval'));if(Number.isInteger(saved)&&saved>=1&&saved<=60)state.intervalSeconds=saved; } catch (_) {}
    state.setInterval = function(seconds,save=true){
        this.intervalSeconds=clamp(Math.round(Number(seconds)||12),1,60);
        if(save)try{localStorage.setItem('matrixRain.autoSceneInterval',String(this.intervalSeconds));}catch(_){}
        if(typeof autoOrchestratorActive!=='undefined'&&autoOrchestratorActive){stopAutoOrchestrator();scheduleNextChange();}
        const input=el('autoSceneInterval'),value=el('autoSceneIntervalValue');
        if(input)input.value=this.intervalSeconds;if(value)value.textContent=this.intervalSeconds+'s';
    };
    const config = () => MatrixRainEngine.rainConfig;
    const ease = t => t*t*t*(t*(t*6-15)+10);
    function tween(object,key,to,duration=3,rounded=false,changed=null,delay=0) {
        // DOM sliders (including configuration imports) supply text values.
        state.tweens.push({object,key,from:Number(object[key]),to:Number(to),duration,elapsed:0,rounded,changed,delay});
    }
    function densityRange() {
        const flat = rainCamera.continuous ? 1-rainCamera.perspective : rainCamera.enabled?0:1;
        // Flat projection has a much smaller visible volume. Keep its coverage
        // fuller, while multi-axis currents need more breathing room in depth.
        const flow = window.rainAllDirections.mode;
        const low = flow==='crossflow'?24:32, high=flow==='crossflow'?44:58;
        return [Math.round(low+(68-low)*flat),Math.round(high+(90-high)*flat)];
    }
    function matchDensity(flat) {
        const flow = window.rainAllDirections.mode;
        const target = flat?integer(70,86):flow==='crossflow'?integer(28,42):integer(36,54);
        tween(config(),'density',target,4,true,recomputeActiveColumnsMask);
    }
    function sync() {
        const c=config();
        for (const [id,value] of Object.entries({rainSpeed:101-c.speed,rainIntensity:c.intensity,
            rainDensity:c.density,characterSize:c.fontSize,rainDirection:c.direction,
            primaryColor:c.primaryColor,secondaryColor:c.secondaryColor})) {
            // Audio can leave HSL ink behind when stopped. Preserve its color
            // picker value until Auto supplies its next hex palette.
            if(!id.endsWith('Color')||/^#[0-9a-f]{6}$/i.test(value))el(id).value=value;
        }
        el('charSizeDisplay').textContent=c.fontSize+'px';
        document.querySelectorAll('.pattern-btn').forEach(button=>button.classList.remove('active'));
        document.querySelector(`.pattern-btn[onclick*="'${c.pattern}'"]`)?.classList.add('active');
        rainCamera.refreshControls?.();window.rainTrailControls?.refresh();window.rainRenderingControls?.refresh();
        window.rainSettingsUI?.refresh();
        const auto=el('autoOrchestratorBtn');
        if(auto?.dataset){auto.dataset.sceneStep=state.description;auto.dataset.scenePending=String(state.queue.length);}
    }
    state.advance = function(dt) {
        // Emergency Stop does not advance the presentation clock. Stopping
        // Auto scenes lets an already-started interpolation land gently.
        for(const t of this.tweens){
            const elapsed=Math.max(0,dt-t.delay);t.delay=Math.max(0,t.delay-dt);
            t.elapsed=Math.min(t.duration,t.elapsed+elapsed);
            const raw=t.from+(t.to-t.from)*ease(t.elapsed/t.duration),value=t.rounded?Math.round(raw):raw;
            if(t.object[t.key]!==value){t.object[t.key]=value;t.changed?.();}
        }
        this.tweens=this.tweens.filter(t=>t.elapsed<t.duration);
        if(this.tweens.length||rainCamera.depthTransition||rainCamera.motionFade){
            this.refreshTime+=dt;
            if(this.refreshTime>=.1){this.refreshTime=0;sync();}
        }else if(this.refreshTime){this.refreshTime=0;sync();}
    };
    state.cancelPlan = function(){this.queue.length=0;};
    state.reset = function(){this.queue.length=0;this.tweens.length=0;this.last=null;};
    state.apply = function(step) {
        const c=config(),flow=window.rainAllDirections,render=window.matrixRainRendering,trails=window.matrixRainTrails;
        this.description=step.kind;this.last=step.family||step.kind;
        switch(step.kind){
            case 'hold viewpoint': rainCamera.settleMotion(); break;
            case 'depth':
                rainCamera.setMode('fixed');rainCamera.motionGain=1;rainCamera.motionFade=null;
                rainCamera.transitionDepth(step.value);matchDensity(!step.value);break;
            case 'camera':
                if(step.value!=='fixed')rainCamera.speeds[step.value]=integer(18,36)/100;
                rainCamera.resumeMotion(step.value);break;
            case 'direction': c.direction=step.value;break;
            case 'reverse': c.direction=step.value;reverseFlowMultiplier*=-1;break;
            case 'flow':
                flow.manualMode=step.value;flow.applyMode(step.value,true);
                {const [lo,hi]=densityRange();tween(c,'density',clamp(c.density,lo,hi),3,true,recomputeActiveColumnsMask);}break;
            case 'density': {const [lo,hi]=densityRange();tween(c,'density',clamp(Number(c.density)+pick([-12,12]),lo,hi),3,true,recomputeActiveColumnsMask);break;}
            case 'size': tween(c,'fontSize',clamp(Number(c.fontSize)+pick([-2,2]),8,24),4,true);break;
            case 'pace':
                tween(c,'speed',clamp(Number(c.speed)+pick([-10,10]),22,80),3,true);
                tween(c,'intensity',clamp(Number(c.intensity)+pick([-8,8]),50,90),3,true);break;
            case 'palette': {
                // A nearby hue, shared by both inks. Only new glyphs get it.
                const turn=pick([-40,-24,24,40])*Math.PI/180;
                const cos=Math.cos(turn),sin=Math.sin(turn),u=[1,1,1].map(()=>1/Math.sqrt(3));
                for(const key of ['primaryColor','secondaryColor']){
                    const hex=/^#[0-9a-f]{6}$/i.test(c[key])?c[key]:el(key).value;
                    const rgb=hex.slice(1).match(/../g).map(n=>parseInt(n,16)),dot=rgb.reduce((sum,n,i)=>sum+n*u[i],0);
                    const cross=[u[1]*rgb[2]-u[2]*rgb[1],u[2]*rgb[0]-u[0]*rgb[2],u[0]*rgb[1]-u[1]*rgb[0]];
                    c[key]='#'+rgb.map((n,i)=>Math.round(clamp(n*cos+cross[i]*sin+u[i]*dot*(1-cos),0,255)).toString(16).padStart(2,'0')).join('');
                }break;
            }
            case 'pattern': c.pattern=step.value;break;
            case 'characters':
                el('characterSet').value=step.value;
                el('customCharacters').style.display=step.value==='custom'?'block':'none';
                c.characterSet=step.value==='custom'?el('customCharacters').value.trim():step.value;break;
            case 'render': {
                const option=pick(['sharp','smooth','glow','contrast']);
                if(option==='sharp'||option==='smooth'){render[option]=!render[option];if(option==='sharp')rainCameraGPU.invalidate=true;}
                else tween(render,option,option==='glow'?integer(5,40)/100:integer(85,125)/100);
                break;
            }
            case 'tails':
                // Enter/leave variable lengths through a uniform 40-glyph tail.
                // Existing manual settings still apply immediately as before.
                if(step.value==='uniform'){
                    const update=()=>trails.configure(trails.minimum,trails.maximum);
                    tween(trails,'minimum',40,3,true,update);tween(trails,'maximum',40,3,true,update);
                }
                else if(step.value==='enable'){trails.enabled=true;trails.configure(40,40);rainCamera.syncTrailSettings();}
                else if(step.value==='disable'){trails.enabled=false;rainCamera.syncTrailSettings();}
                else if(step.value==='fade')trails.stepped=!trails.stepped;
                else {
                    const update=()=>trails.configure(trails.minimum,trails.maximum);
                    tween(trails,'minimum',clamp(trails.minimum+pick([-8,8]),24,48),3,true,update);
                    tween(trails,'maximum',clamp(trails.maximum+pick([-12,12]),48,100),3,true,update);
                }
                break;
        }
        sync();
    };
    state.next = function(requestedFamily) {
        if(window.audioReactiveActive)return false;
        if(this.tweens.length||rainCamera.depthTransition||rainCamera.motionFade||window.rainAllDirections.transitioning)return false;
        rainCamera.beginContinuousView();
        if(this.queue.length){this.apply(this.queue.shift());return true;}
        const c=config(),flow=window.rainAllDirections;
        const family=requestedFamily||other(['direction','direction','flow','camera','depth','palette','pace','density','size','characters','pattern','render','tails','reverse'],this.last);
        const add=(kind,value)=>this.queue.push({kind,value,family});
        if(family==='depth'){
            if(rainCamera.enabled){
                if(flow.mode!=='directed')add('flow','directed');
                if(!planar.includes(c.direction))add('direction',pick(planar));
                if(rainCamera.mode!=='fixed'&&rainCamera.motionGain>0)add('hold viewpoint');
                add('depth',false);
            }else{add('depth',true);add('camera',pick(['showcase','corkscrew','gyroscope']));}
        }else if(family==='camera'){
            if(!rainCamera.enabled)add('depth',true);
            else if(rainCamera.mode!=='fixed')add('hold viewpoint');
            add('camera',other(['fixed','showcase','corkscrew','gyroscope'],rainCamera.mode));
        }else if(family==='direction'){
            const choices=rainCamera.enabled?axes:planar,target=other(choices,c.direction);
            if(target===opposite[c.direction])add('direction',pick(choices.filter(v=>v!==target&&v!==c.direction)));
            add('direction',target);
        }else if(family==='reverse'){
            const choices=rainCamera.enabled?axes:planar;
            add('direction',pick(choices.filter(v=>v!==c.direction&&v!==opposite[c.direction])));
            add('reverse',c.direction);
        }else if(family==='flow'){
            const target=other(['directed','counterflow','crossflow'],flow.mode);
            if((target==='directed'&&flow.mode==='crossflow')||(target==='crossflow'&&flow.mode==='directed'))add('flow','counterflow');
            add('flow',target);
        }else if(family==='pattern'){
            const target=other(['classic','rainbow','pentad','chaos','harmonic'],c.pattern);
            if(c.pattern!=='classic'&&target!=='classic')add('pattern','classic');
            add('pattern',target);
        }else if(family==='characters'){
            const choices=['matrix','binary','hex','symbols','katakana'];
            if(el('customCharacters').value.trim())choices.push('custom');
            add('characters',other(choices,el('characterSet').value));
        }else if(family==='tails'){
            const trails=window.matrixRainTrails;
            if(Math.random()<.3)add('tails','fade');
            else if(!trails.enabled){add('tails','enable');add('tails','vary');}
            else if(Math.random()<.5){add('tails','uniform');add('tails','disable');}
            else add('tails','vary');
        }else add(family);
        this.apply(this.queue.shift());return true;
    };
})();
