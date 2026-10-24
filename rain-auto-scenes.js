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
    const state = window.rainAutoScenes = {queue:[],tweens:[],last:null,description:'',refreshTime:0,intervalSeconds:12,preparingFlat:false,families:[],
        includeCloud:false,cloudPass:null};
    try { const saved=Number(localStorage.getItem('matrixRain.autoSceneInterval'));if(Number.isFinite(saved)&&saved>=.1&&saved<=60)state.intervalSeconds=saved; } catch (_) {}
    try { state.includeCloud=localStorage.getItem('matrixRain.autoSceneCloud')==='1'; } catch (_) {}
    const cloudActive = () => !!window.rainCloud?.active;
    const cloudTransition = () => {
        const cloud=window.rainCloud;
        return !!(cloud?.active&&(cloud.returning||(!state.cloudPass&&(cloud.gathering||cloud.entryAge<cloud.entryDuration))));
    };
    const directional = step => ['direction','reverse','flow'].includes(step.kind);
    const cloudStepAllowed = step => state.cloudPass?directional(step)
        : step.kind!=='tails'&&!(step.kind==='depth'&&!step.value)&&step.kind!=='align viewpoint'&&step.kind!=='prepare flat';
    // A passage covers an already-chosen direction/flow change. It does not
    // choose destinations or create a second scene/residence scheduler.
    // Cloud alone gets at least five seconds before the unchanged rewind.
    // The ordinary Auto scene interval retains its full 0.1–60 second range.
    const passageDuration = variation => window.rainAutoPreferences?.cloudSeconds ?? Math.max(5,state.intervalSeconds*.4*variation);
    state.beginCloudPass = function(step){
        if(window.rainAutoPreferences?.managesAppearances)return;
        const cloud=window.rainCloud;
        if(!this.includeCloud||!directional(step)||cloudActive()||!cloud||cloud.error)return;
        if(!cloud.engine?.ready){cloud.prepare?.();return;}
        cloud.choose(true); // Capture the displayed heads BEFORE changing course.
        if(cloud.active)this.cloudPass={variation:.85+Math.random()*.3};
    };
    state.setIncludeCloud = function(enabled,save=true){
        this.includeCloud=!!enabled;
        if(save)try{localStorage.setItem('matrixRain.autoSceneCloud',this.includeCloud?'1':'0');}catch(_){}
        if(this.includeCloud)window.rainCloud?.prepare?.();
        if(!this.includeCloud&&this.cloudPass&&cloudActive()&&!window.rainCloud.returning)window.rainCloud.choose(false);
        const input=el('autoSceneCloud');if(input)input.checked=this.includeCloud;
        window.rainSettingsUI?.refresh();
    };
    state.manualCloudChoice = function(){
        // Manual cloud has no automatic deadline, even with Auto scenes on.
        this.cloudPass=null;this.reset();
        window.rainAutoPreferences?.manual?.();
    };
    state.setInterval = function(seconds,save=true){
        this.intervalSeconds=clamp(Math.round((Number(seconds)||12)*10)/10,.1,60);
        if(save)try{localStorage.setItem('matrixRain.autoSceneInterval',String(this.intervalSeconds));}catch(_){}
        if(typeof autoOrchestratorActive!=='undefined'&&autoOrchestratorActive){stopAutoOrchestrator();scheduleNextChange();}
        const input=el('autoSceneInterval'),value=el('autoSceneIntervalValue');
        if(input)input.value=this.intervalSeconds;if(value)value.textContent=this.intervalSeconds+'s';
    };
    const config = () => MatrixRainEngine.rainConfig;
    const spatialKinds = new Set(['hold viewpoint','align viewpoint','prepare flat','depth','camera','flow','density','size','render','tails']);
    const spatialFamilies = ['camera','depth','flow','density','size','render','tails'];
    function nextSpatialFamily() {
        if(window.rainAutoPreferences)state.families=state.families.filter(window.rainAutoPreferences.familyAllowed);
        if(!state.families.length){
            // Cover the major controls in random order before visiting any again.
            // This prevents long runs of tiny rendering/tail changes.
            state.families=['camera','depth','flow','density','size',pick(['render','tails'])];
            if(window.rainAutoPreferences)state.families=window.rainAutoPreferences.families(state.families);
            if(window.rainAutoPreferences?.program?.order!=='sequence')for(let i=state.families.length-1;i>0;i--){const j=integer(0,i);[state.families[i],state.families[j]]=[state.families[j],state.families[i]];}
            if(state.families.length>1&&state.families[0]===state.last)[state.families[0],state.families[1]]=[state.families[1],state.families[0]];
        }
        return state.families.shift();
    }
    function separatedTarget(current,values,gap) {
        const candidates=values.filter(value=>Math.abs(value-Number(current))>=gap);
        return candidates.length?pick(candidates):values.reduce((best,value)=>Math.abs(value-current)>Math.abs(best-current)?value:best);
    }
    const canFlattenWithAudio = () => window.rainAllDirections.mode==='directed' && planar.includes(config().direction)
        && rainMotion.drops.every((head,index)=>!head || (window.activeColumnsMask && !window.activeColumnsMask[index])
            || !head.lastStepDirection || planar.includes(head.lastStepDirection))
        && [...window.rainAllDirections.forks.values()].every(fork=>!fork.remaining || planar.includes(fork.direction)
            || (window.activeColumnsMask && !window.activeColumnsMask[fork.head.sourceId]));
    state.syncAudioOwnership = function() {
        const audio = !!(window.audioReactiveActive || window.rainAudioStarting || window.rainSessionControls?.audioPaused);
        if(audio){
            // A queued direction/palette change or an already-running pace tween
            // must not compete with the next audio analysis frame.
            this.queue=this.queue.filter(step=>spatialKinds.has(step.kind));
            this.tweens=this.tweens.filter(t=>t.object!==config() || !['speed','intensity'].includes(t.key));
        }
        this.audioOwned=audio;
        return audio;
    };
    const ease = t => t*t*t*(t*(t*6-15)+10);
    // Auto owns a bounded workspace. Manual sliders keep their complete range.
    // Source count grows with viewport width; long tails and large glyphs then
    // multiply that cost in every visible copy of the repeating world.
    const limits = {minimumFont:14,font:20,tail:64,minimumTail:40,minimumDelay:30};
    const fontChoices = [14,16,18,20];
    function flatAmount() { return rainCamera.continuous?clamp(1-rainCamera.perspective,0,1):rainCamera.enabled?0:1; }
    state.loadBudget = function() {
        const c=config(),trails=window.matrixRainTrails,flat=flatAmount();
        const columns=Math.max(1,Math.floor(matrixCanvas.width/10));
        // Old large glyphs stay exactly where they were born until they fade.
        // Include them while limiting new births rather than resizing history.
        const font=Math.max(Number(c.fontSize),Number(rainCamera.bounds?.pad||0)/1.6);
        const life=trails?.enabled?Number(trails.maximum):40;
        const area=Math.max(1,font/14)**2,reserve=1.12;
        // Conservative 14px glyph-work units, not a hardware-specific FPS
        // promise. Reserve room for temporary branches during flow handoffs.
        const maximum=6000+4000*flat;
        const density=Math.max(1,Math.floor((maximum/(life*area*reserve)-.5)/columns*100));
        const sources=Math.max(window.rainAllDirections.enabled?(rainCamera.enabled?6:4):1,Math.round(columns*Number(c.density)/100));
        return {density,work:sources*life*area*reserve,maximum};
    };
    function limitWork(audio) {
        const c=config(),trails=window.matrixRainTrails;
        const keeps=key=>window.rainAutoPreferences?.keeps(key);
        let changed=false;
        const fontRange=window.rainAutoPreferences?.range('fontSize',[limits.minimumFont,limits.font])||[limits.minimumFont,limits.font];
        const font=clamp(Number(c.fontSize),...fontRange);
        if(!keeps('size')&&Number(c.fontSize)!==font){c.fontSize=font;changed=true;}
        if(!keeps('speed')&&!audio&&Number(c.speed)<limits.minimumDelay){c.speed=limits.minimumDelay;changed=true;}
        if(!keeps('trails')&&trails?.enabled&&!cloudActive()){
            const min=clamp(Number(trails.minimum),24,limits.minimumTail),max=clamp(Number(trails.maximum),40,limits.tail);
            if(trails.minimum!==min||trails.maximum!==max){trails.configure(min,max);changed=true;}
        }
        const [,high]=densityRange(),density=Math.min(Number(c.density),high);
        if(!keeps('density')&&Number(c.density)!==density){c.density=density;recomputeActiveColumnsMask();changed=true;}
        // A pending density tween must not land beyond a budget that has shrunk
        // as projection opens or larger glyphs enter the field.
        for(const t of state.tweens)if(t.object===c&&t.key==='density')t.to=Math.min(t.to,high);
        return changed;
    }
    function tween(object,key,to,duration=3,rounded=false,changed=null,delay=0) {
        const policy=window.rainAutoPreferences;
        if(object===config()&&policy){
            if(policy.keepsField(key))return;
            let range={fontSize:[14,20],density:densityRange(),speed:[30,80],intensity:[50,90]}[key];
            if(range&&key!=='density')range=policy.range?.(key,range)||range;
            if(range)to=policy.numeric(Number(object[key]),Number(to),...range);
        }
        // DOM sliders (including configuration imports) supply text values.
        state.tweens.push({object,key,from:Number(object[key]),to:Number(to),duration,elapsed:0,rounded,changed,delay});
    }
    function densityRange() {
        const flat = flatAmount();
        // Flat projection has a much smaller visible volume. Keep its coverage
        // fuller, while multi-axis currents need more breathing room in depth.
        const flow = window.rainAllDirections.mode;
        const requested=window.rainAutoPreferences?.range('density',null);
        if(requested){const high=Math.min(requested[1],state.loadBudget().density);return[Math.min(requested[0],high),high];}
        const low = flow==='crossflow'?20:24, high=flow==='crossflow'?32:42;
        const cap=Math.min(Math.round(high+(78-high)*flat),state.loadBudget().density);
        return [Math.min(Math.round(low+(58-low)*flat),cap),cap];
    }
    function matchDensity(flat) {
        const flow = window.rainAllDirections.mode;
        const target = flat?integer(62,76):flow==='crossflow'?integer(24,30):integer(28,40);
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
        this.syncAudioOwnership();
        window.rainAutoPreferences?.advance?.(dt);
        if(this.cloudPass&&!window.rainAutoPreferences?.managesAppearances){
            const cloud=window.rainCloud;
            if(!cloudActive())this.cloudPass=null;
            else if(!cloud.returning&&!window.rainSessionControls?.stopped
                &&(!this.includeCloud||cloud.entryAge>=passageDuration(this.cloudPass.variation)))cloud.choose(false);
        }
        if(this.preparingFlat && !rainCamera.enabled && !rainCamera.depthTransition)this.preparingFlat=false;
        const finishingTweens=this.tweens.length>0;
        // Emergency Stop does not advance the presentation clock. Stopping
        // Auto scenes lets an already-started interpolation land gently.
        for(const t of this.tweens){
            const elapsed=Math.max(0,dt-t.delay);t.delay=Math.max(0,t.delay-dt);
            t.elapsed=Math.min(t.duration,t.elapsed+elapsed);
            const raw=t.from+(t.to-t.from)*ease(t.elapsed/t.duration),value=t.rounded?Math.round(raw):raw;
            if(t.object[t.key]!==value){t.object[t.key]=value;t.changed?.();}
        }
        this.tweens=this.tweens.filter(t=>t.elapsed<t.duration);
        if(!this.cloudPass&&!cloudTransition()&&((typeof autoOrchestratorActive!=='undefined'&&autoOrchestratorActive)||finishingTweens)&&limitWork(this.audioOwned))sync();
        if(this.tweens.length||rainCamera.depthTransition||rainCamera.motionFade){
            this.refreshTime+=dt;
            if(this.refreshTime>=.1){this.refreshTime=0;sync();}
        }else if(this.refreshTime){this.refreshTime=0;sync();}
    };
    state.cancelPlan = function(){this.queue.length=0;this.preparingFlat=false;};
    state.reset = function(){this.queue.length=0;this.tweens.length=0;this.last=null;this.preparingFlat=false;this.families.length=0;};
    state.apply = function(step) {
        if(window.rainAutoPreferences&&!window.rainAutoPreferences.allows(step))return false;
        const audio = this.syncAudioOwnership();
        if(audio && !spatialKinds.has(step.kind))return false;
        if(cloudTransition())return false;
        if(cloudActive()&&!cloudStepAllowed(step))return false;
        const c=config(),flow=window.rainAllDirections,render=window.matrixRainRendering,trails=window.matrixRainTrails;
        // Closing only starts from a compatible current heading. Audio then
        // sees enabled=false and keeps its existing four-direction steering.
        // Preparation lets the audio controller choose a planar heading, and
        // existing native paths finish their depth segments before closing.
        if(audio && step.kind==='depth' && !step.value && !canFlattenWithAudio())return false;
        this.beginCloudPass(step);
        this.description=step.kind;this.last=step.family||step.kind;
        switch(step.kind){
            case 'prepare flat': this.preparingFlat=true;break;
            case 'hold viewpoint': rainCamera.settleMotion(); break;
            case 'align viewpoint': {
                // Freeze only the viewpoint, then turn the same world gently
                // away from an edge-on flat projection. Both planar axes must
                // remain readable, including when the next beat changes axis.
                rainCamera.setMode('fixed');
                const radians=Math.PI/180;
                const target=window.RainCameraMotion.safePlanarAngles(rainCamera.yaw*radians,rainCamera.pitch*radians,rainCamera.roll*radians);
                for(const axis of ['yaw','pitch'])if(Math.abs(target[axis]/radians-rainCamera[axis])>1e-6)tween(rainCamera,axis,target[axis]/radians,2.5);
                break;
            }
            case 'depth':
                rainCamera.setMode('fixed');rainCamera.motionGain=1;rainCamera.motionFade=null;
                if(step.value)this.preparingFlat=false;
                rainCamera.transitionDepth(step.value);matchDensity(!step.value);break;
            case 'camera':
                if(step.value!=='fixed'&&(!window.rainAutoPreferences||window.rainAutoPreferences.values('camera').length>1))rainCamera.speeds[step.value]=integer(18,36)/100;
                rainCamera.resumeMotion(step.value);break;
            case 'direction': c.direction=step.value;break;
            case 'reverse': c.direction=step.value;reverseFlowMultiplier*=-1;break;
            case 'flow':
                flow.manualMode=step.value;flow.applyMode(step.value,true);
                {const [lo,hi]=densityRange();tween(c,'density',clamp(c.density,lo,hi),3,true,recomputeActiveColumnsMask);}break;
            case 'density': {const [lo,hi]=densityRange();const target=audio?separatedTarget(c.density,[lo,Math.round((lo+hi)/2),hi],15):clamp(Number(c.density)+pick([-12,12]),lo,hi);tween(c,'density',target,3,true,recomputeActiveColumnsMask);break;}
            // Choose another readable size rather than a clamped random walk,
            // which can repeatedly land on the same lower boundary.
            case 'size':
                {const [lo,hi]=window.rainAutoPreferences?.range('fontSize',[limits.minimumFont,limits.font])||[limits.minimumFont,limits.font];
                c.fontSize=clamp(Number(c.fontSize),lo,hi);
                const choices=window.rainAutoPreferences?[lo,Math.round((lo+hi)/2),hi]:fontChoices;
                tween(c,'fontSize',separatedTarget(c.fontSize,choices,2),4,true);}break;
            case 'pace':
                tween(c,'speed',clamp(Number(c.speed)+pick([-10,10]),limits.minimumDelay,80),3,true);
                tween(c,'intensity',clamp(Number(c.intensity)+pick([-8,8]),50,90),3,true);break;
            case 'palette': {
                // A nearby hue, shared by both inks. Only new glyphs get it.
                const turn=(window.rainAutoPreferences?.hueTurn()??pick([-40,-24,24,40]))*Math.PI/180;
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
                const option=pick(audio||cloudActive()?['sharp','glow','contrast']:['sharp','smooth','glow','contrast']);
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
                    tween(trails,'minimum',clamp(trails.minimum+pick([-8,8]),24,limits.minimumTail),3,true,update);
                    tween(trails,'maximum',clamp(trails.maximum+pick([-12,12]),40,limits.tail),3,true,update);
                }
                break;
        }
        limitWork(audio);sync();
        return true;
    };
    state.next = function(requestedFamily) {
        const audio = this.syncAudioOwnership();
        const policy=window.rainAutoPreferences;
        if(requestedFamily&&policy&&!policy.familyAllowed(requestedFamily))return false;
        if(audio && requestedFamily && !spatialFamilies.includes(requestedFamily))return false;
        if(this.tweens.length||rainCamera.depthTransition||rainCamera.motionFade||cloudTransition()||(!audio&&window.rainAllDirections.transitioning))return false;
        rainCamera.beginContinuousView();
        // A manually held cloud can keep exploring compatible Auto settings;
        // do not leave it stuck behind a queued flatten/tail operation.
        if(cloudActive()&&!this.cloudPass&&this.queue.length&&!cloudStepAllowed(this.queue[0]))this.cancelPlan();
        if(this.queue.length){const applied=this.apply(this.queue[0]);if(applied)this.queue.shift();return applied;}
        if(policy?.canSchedule&&!policy.canSchedule())return false;
        if(this.cloudPass&&cloudActive())return false;
        const c=config(),flow=window.rainAllDirections;
        let choices=['direction','direction','flow','camera','depth','palette','pace','density','size','characters','pattern','render','tails','reverse'];
        if(policy)choices=policy.families(choices);
        let family=requestedFamily||policy?.requiredFamily?.()||(audio?nextSpatialFamily():policy?.program?.order==='sequence'?choices[(choices.indexOf(this.last)+1)%choices.length]:pick(choices.some(v=>v!==this.last)?choices.filter(v=>v!==this.last):choices));
        if(!family){this.description='Keeping your settings';sync();return true;}
        if(cloudActive()&&!this.cloudPass&&['depth','tails'].includes(family))return false;
        const add=(kind,value)=>this.queue.push({kind,value,family});
        const cameraTarget=family==='camera'&&policy?.choose?policy.choose('camera',policy.cameraNow(),policy.available('camera')):null;
        if(family==='depth'||cameraTarget==='flat'){
            if(rainCamera.enabled){
                if(audio)add('prepare flat');
                if(flow.mode!=='directed')add('flow','directed');
                if(!audio && !planar.includes(c.direction))add('direction',pick(planar));
                if(rainCamera.mode!=='fixed'&&rainCamera.motionGain>0)add('hold viewpoint');
                add('align viewpoint');
                add('depth',false);
            }else{add('depth',true);add('camera',pick(['showcase','corkscrew','gyroscope']));}
        }else if(family==='camera'){
            if(!rainCamera.enabled)add('depth',true);
            else if(rainCamera.mode!=='fixed')add('hold viewpoint');
            add('camera',cameraTarget||other(['fixed','showcase','corkscrew','gyroscope'],rainCamera.mode));
        }else if(family==='direction'){
            const choices=rainCamera.enabled?axes:planar,allowed=policy?.values?policy.values('direction').filter(v=>choices.includes(v)):choices;
            if(!allowed.length)return false;
            const target=policy?.choose?policy.choose('direction',c.direction,allowed):other(choices,c.direction);
            if(target===opposite[c.direction])add('direction',pick(choices.filter(v=>v!==target&&v!==c.direction)));
            add('direction',target);
        }else if(family==='reverse'){
            const choices=rainCamera.enabled?axes:planar;
            add('direction',pick(choices.filter(v=>v!==c.direction&&v!==opposite[c.direction])));
            add('reverse',c.direction);
        }else if(family==='flow'){
            const target=policy?.choose?policy.choose('flow',flow.mode):other(['directed','counterflow','crossflow'],flow.mode);
            if((target==='directed'&&flow.mode==='crossflow')||(target==='crossflow'&&flow.mode==='directed'))add('flow','counterflow');
            add('flow',target);
        }else if(family==='pattern'){
            const target=other(['classic','rainbow','pentad','chaos','harmonic'],c.pattern);
            if(c.pattern!=='classic'&&target!=='classic')add('pattern','classic');
            add('pattern',target);
        }else if(family==='characters'){
            const choices=policy?.values?policy.values('characters').filter(v=>v!=='custom'||el('customCharacters').value.trim()):['matrix','binary','hex','symbols','katakana'];
            if(!policy?.values&&el('customCharacters').value.trim())choices.push('custom');
            if(!choices.length)return false;
            add('characters',policy?.choose?policy.choose('characters',el('characterSet').value,choices):other(choices,el('characterSet').value));
        }else if(family==='tails'){
            const trails=window.matrixRainTrails;
            if(Math.random()<.3)add('tails','fade');
            else if(!trails.enabled){add('tails','enable');add('tails','vary');}
            else if(Math.random()<.5){add('tails','uniform');add('tails','disable');}
            else add('tails','vary');
        }else add(family);
        // A route may have prerequisites in another family. Never bypass a
        // kept setting just to reach a random destination.
        if(policy&&this.queue.some(step=>!policy.allows(step))){this.cancelPlan();return false;}
        const applied=this.apply(this.queue[0]);if(applied)this.queue.shift();return applied;
    };
})();
