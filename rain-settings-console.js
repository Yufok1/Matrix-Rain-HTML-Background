// Presentation only: one existing rain renderer, with no copied preview canvas.
export function mountSettingsConsole(modal,content,actions){
    const desktop=matchMedia('(min-width:701px) and (min-height:480px) and (hover:hover)');
    let mode='panel';try{if(localStorage.getItem('matrixRain.settingsLayout')==='console')mode='console';}catch{}
    const toggle=document.createElement('button');toggle.type='button';toggle.className='settings-view-toggle';toggle.id='rain-settings-view';actions.prepend(toggle);
    const stage=document.createElement('div');stage.className='tv-stage';stage.innerHTML=`<div class="tv-flight-label">OMNI / LIVE VIEW</div><div class="tv-window"><div class="tv-rain-port" aria-label="Live rain preview"></div></div><div class="tv-brand">MATRIX RAIN<strong>OMNI</strong></div><div class="tv-flight-caption">Your changes are visible in the window.</div>`;content.append(stage);
    const port=stage.querySelector('.tv-rain-port');
    const hull=document.createElementNS('http://www.w3.org/2000/svg','svg');hull.classList.add('tv-hull');hull.setAttribute('aria-hidden','true');document.body.append(hull);
    const dials=Array.from(content.querySelectorAll('input[type=range]'),input=>{
        const shell=document.createElement('div');shell.className='settings-dial-shell';input.before(shell);shell.append(input);
        const knob=document.createElement('div');knob.className='tv-dial';knob.setAttribute('role','slider');
        const label=document.querySelector('label[for="'+input.id+'"]');
        const title=label?Array.from(label.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim():input.previousElementSibling?.textContent||input.id;
        knob.setAttribute('aria-label',title);knob.setAttribute('aria-valuemin',input.min);knob.setAttribute('aria-valuemax',input.max);
        knob.innerHTML='<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="dial-track" cx="50" cy="50" r="42"/><circle class="dial-face" cx="50" cy="50" r="32"/><g class="dial-pointer"><path d="M50 23V39"/></g><path class="dial-notch" d="M22 78L26 74M78 78L74 74"/></svg><output class="tv-dial-value"></output>';
        shell.append(knob);let drag=null;
        const disabled=()=>input.disabled||!!input.closest('fieldset:disabled');
        const update=()=>{const value=Number(input.value),min=Number(input.min),max=Number(input.max);knob.style.setProperty('--dial-angle',(-135+270*(value-min)/Math.max(1,max-min))+'deg');knob.setAttribute('aria-valuenow',input.value);knob.setAttribute('aria-disabled',String(disabled()));knob.tabIndex=disabled()?-1:0;knob.querySelector('output').textContent=input.value;};
        const set=value=>{if(disabled())return;const step=Number(input.step)||1;input.value=String(Math.max(Number(input.min),Math.min(Number(input.max),Math.round(value/step)*step)));input.dispatchEvent(new Event('input',{bubbles:true}));update();};
        knob.addEventListener('pointerdown',event=>{if(disabled()||event.button!==0)return;drag={id:event.pointerId,y:event.clientY,value:Number(input.value)};knob.setPointerCapture(event.pointerId);knob.focus();event.preventDefault();});
        knob.addEventListener('pointermove',event=>{if(drag?.id===event.pointerId)set(drag.value+(drag.y-event.clientY)*(Number(input.max)-Number(input.min))/160);});
        const finish=event=>{if(drag?.id!==event.pointerId)return;drag=null;input.dispatchEvent(new Event('change',{bubbles:true}));};
        knob.addEventListener('pointerup',finish);knob.addEventListener('pointercancel',finish);knob.addEventListener('lostpointercapture',finish);
        knob.addEventListener('keydown',event=>{const step=(Number(input.step)||1)*(event.shiftKey?10:1),value=Number(input.value);const next=event.key==='ArrowUp'||event.key==='ArrowRight'?value+step:event.key==='ArrowDown'||event.key==='ArrowLeft'?value-step:event.key==='Home'?Number(input.min):event.key==='End'?Number(input.max):null;if(next===null)return;event.preventDefault();event.stopPropagation();set(next);input.dispatchEvent(new Event('change',{bubbles:true}));});
        input.addEventListener('input',update);input.addEventListener('change',update);return update;
    });
    let pending=0;
    function geometry(){
        pending=0;if(!document.body.classList.contains('rain-tv-view'))return;
        const w=innerWidth,h=innerHeight;stage.style.setProperty('--view-aspect',w+'/'+h);
        const rect=port.getBoundingClientRect(),x=rect.left,y=rect.top,r=rect.right,b=rect.bottom;
        for(const [name,value]of [['x',x],['y',y],['width',rect.width],['height',rect.height]])document.documentElement.style.setProperty('--rain-port-'+name,value+'px');
        hull.setAttribute('viewBox','0 0 '+w+' '+h);
        const outer=[[0,0],[w,0],[w,h],[0,h]],inner=[[x,y],[r,y],[r,b],[x,b]],points=list=>list.map(p=>p.join(',')).join(' ');
        let markup='<defs><linearGradient id="hull-metal" x2="0" y2="1"><stop stop-color="#18221e"/><stop offset="1" stop-color="#080e0b"/></linearGradient></defs>';
        for(let i=0;i<4;i++){const next=(i+1)%4;markup+='<polygon class="hull-plane plane-'+i+'" points="'+points([outer[i],outer[next],inner[next],inner[i]])+'"/>';markup+='<path class="hull-seam" d="M'+outer[i].join(' ')+'L'+inner[i].join(' ')+'"/>';}
        for(const amount of [.24,.5,.76]){const ring=outer.map((p,i)=>p.map((v,axis)=>v+(inner[i][axis]-v)*amount));markup+='<polygon class="hull-rib" points="'+points(ring)+'"/>';}
        hull.innerHTML=markup;
    }
    function schedule(){if(!pending)pending=requestAnimationFrame(geometry);}
    function refresh(){
        const active=mode==='console'&&desktop.matches&&!modal.classList.contains('minimized');
        if(modal.classList.contains('tv-console')!==active)modal.classList.toggle('tv-console',active);
        document.body.classList.toggle('rain-tv-view',active);
        toggle.textContent=mode==='console'?'Panel controls':'TV console';toggle.setAttribute('aria-pressed',String(mode==='console'));
        toggle.title=mode==='console'?'Use the compact settings panel':'Use the spaceship console and central rain window';
        if(active)modal.querySelector('.panel-drag-hint').textContent=window.rainSessionControls?.stopped?'Stopped · settings preserved':'Flight console · live rain window';
        dials.forEach(update=>update());schedule();
    }
    toggle.onclick=()=>{mode=mode==='console'?'panel':'console';try{localStorage.setItem('matrixRain.settingsLayout',mode);}catch{}refresh();};
    desktop.addEventListener('change',refresh);window.addEventListener('resize',schedule);
    new ResizeObserver(schedule).observe(port);new MutationObserver(refresh).observe(modal,{attributes:true,attributeFilter:['class']});
    return {refresh};
}
