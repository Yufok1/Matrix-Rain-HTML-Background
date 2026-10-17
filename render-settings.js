window.matrixRainRendering = {sharp:true,smooth:true,quality:'balanced',glow:.15,contrast:1};
try{Object.assign(window.matrixRainRendering,JSON.parse(localStorage.getItem('matrixRain.rendering')||'null')||{});}catch(_){}
window.addEventListener('DOMContentLoaded',()=>{
    const settings=window.matrixRainRendering;
    const panel=document.createElement('div');panel.id='rain-rendering-panel';
    panel.style.cssText='border:1px solid #00ff41;padding:12px;margin:12px 0;background:#071009;text-align:left';
    panel.innerHTML=`<strong>Rendering</strong>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin:10px 0">
        <label><input type="checkbox" id="render-sharp"> Sharp letters</label>
        <label><input type="checkbox" id="render-smooth"> Smooth motion</label></div>
        <div role="group" aria-label="Rendering quality" style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" type="button" data-quality="balanced">Balanced</button>
        <button class="btn" type="button" data-quality="sharp">High clarity</button>
        <button class="btn" type="button" data-quality="low">Low power</button></div>
        <small style="display:block;margin-top:8px">Low power caps motion at 30 FPS. These controls affect the 3D camera view.</small>
        <label for="render-glow" style="display:block;margin-top:10px">Glow: <span id="render-glow-value"></span>%</label>
        <input type="range" id="render-glow" min="0" max="100" step="1" style="width:100%">
        <label for="render-contrast" style="display:block;margin-top:8px">Color contrast: <span id="render-contrast-value"></span>%</label>
        <input type="range" id="render-contrast" min="75" max="150" step="1" style="width:100%">`;
    document.getElementById('audioReactiveBtn').parentElement.before(panel);
    const sharp=panel.querySelector('#render-sharp'),smooth=panel.querySelector('#render-smooth');
    const glow=panel.querySelector('#render-glow'),contrast=panel.querySelector('#render-contrast');
    function refresh(){
        sharp.checked=settings.sharp!==false;smooth.checked=settings.smooth!==false;
        glow.value=Math.round(settings.glow*100);contrast.value=Math.round(settings.contrast*100);
        panel.querySelector('#render-glow-value').textContent=glow.value;
        panel.querySelector('#render-contrast-value').textContent=contrast.value;
        for(const button of panel.querySelectorAll('[data-quality]')){
            const active=button.dataset.quality===settings.quality;
            button.setAttribute('aria-pressed',String(active));button.style.outline=active?'2px solid #00ff41':'';
        }
    }
    function save(){try{localStorage.setItem('matrixRain.rendering',JSON.stringify(settings));}catch(_){}refresh();}
    sharp.onchange=()=>{settings.sharp=sharp.checked;rainCameraGPU.invalidate=true;save();};
    smooth.onchange=()=>{settings.smooth=smooth.checked;save();};
    glow.oninput=()=>{settings.glow=Number(glow.value)/100;save();};
    contrast.oninput=()=>{settings.contrast=Number(contrast.value)/100;save();};
    for(const button of panel.querySelectorAll('[data-quality]'))button.onclick=()=>{settings.quality=button.dataset.quality;save();};
    window.rainRenderingControls = {refresh};
    refresh();
});
