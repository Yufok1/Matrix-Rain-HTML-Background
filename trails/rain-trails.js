import {RainTrailLengths} from './rain-trail-lengths.js';
const trails = window.matrixRainTrails = new RainTrailLengths();
try {
    const saved = JSON.parse(localStorage.getItem('matrixRain.trails'));
    if (saved) { trails.configure(saved.minimum, saved.maximum); trails.enabled = saved.enabled !== false; trails.stepped = saved.stepped !== false; }
} catch (_) {}
const panel = document.createElement('div');
panel.id = 'rain-trails-panel';
panel.style.cssText = 'border:1px solid #00ff41;padding:12px;margin:12px 0;background:#071009;text-align:left';
panel.innerHTML = `<strong>3D Rain trails</strong>
    <p style="font-size:12px;margin:8px 0">Each drop keeps its own tail length as it moves and turns.</p>
    <label><input type="checkbox" id="trail-variety"> Variable tail lengths</label>
    <div style="margin:8px 0"><label><input type="checkbox" id="trail-stepped"> Stepped fade</label></div>
    <div style="margin-top:8px"><label for="trail-shortest">Shortest tail: <span id="trail-shortest-value"></span> characters</label>
    <input id="trail-shortest" type="range" min="12" max="160" step="1" style="width:100%"></div>
    <div><label for="trail-longest">Longest tail: <span id="trail-longest-value"></span> characters</label>
    <input id="trail-longest" type="range" min="12" max="160" step="1" style="width:100%"></div>`;
document.getElementById('audioReactiveBtn').parentElement.before(panel);
const shortest = panel.querySelector('#trail-shortest'), longest = panel.querySelector('#trail-longest'), variety = panel.querySelector('#trail-variety');
const stepped = panel.querySelector('#trail-stepped');
function refresh() {
    stepped.checked = trails.stepped;
    shortest.value = trails.minimum; longest.value = trails.maximum; variety.checked = trails.enabled;
    shortest.disabled = longest.disabled = !trails.enabled;
    panel.querySelector('#trail-shortest-value').textContent = trails.minimum;
    panel.querySelector('#trail-longest-value').textContent = trails.maximum;
}
function save() {
    try {localStorage.setItem('matrixRain.trails', JSON.stringify({minimum:trails.minimum, maximum:trails.maximum, enabled:trails.enabled, stepped:trails.stepped}));} catch (_) {}
    refresh();
}
shortest.oninput = () => { trails.configure(shortest.value, Math.max(Number(shortest.value), Number(longest.value))); save(); };
longest.oninput = () => { trails.configure(Math.min(Number(shortest.value), Number(longest.value)), longest.value); save(); };
stepped.onchange = () => { trails.stepped = stepped.checked; save(); };
variety.onchange = () => { trails.enabled = variety.checked; save(); };
refresh();
