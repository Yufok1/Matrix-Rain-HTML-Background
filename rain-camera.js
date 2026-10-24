// The 3D camera is enabled by default; Original View restores the base renderer.
const rainCamera = {
    enabled: true, orbit: false, yaw: 0, pitch: 0, roll: 0, frame: 0, marks: [], lastTime: null,
    mode: 'fixed', motionTime: 0, motionBase: {yaw: 0, pitch: 0, roll: 0},
    speeds: {showcase: .25, corkscrew: .25, gyroscope: .25},
    phaseRates: {showcase: 10, corkscrew: 3, gyroscope: 1},
    continuous: false, perspective: 1, depthTransition: null, motionGain: 1,
    get active() { return this.enabled || this.continuous; },
    projectionDepth(z) { return rainFocalLength + (z - rainFocalLength) * (this.continuous ? this.perspective : 1); },
    beginContinuousView() {
        if (this.continuous) return;
        this.continuous = true; this.perspective = this.enabled ? 1 : 0;
        if (!this.enabled) {
            // Flat history has been recorded at its actual screen coordinates.
            // Adopt that field, including its tails, before adding perspective.
            this.yaw = this.pitch = this.roll = 0;
            this.setMode('fixed');
            for (const p of rainMotion.drops) if (p) {
                p.depth = rainFocalLength;
                if (p.lastStamp) p.lastStamp.depth = rainFocalLength;
            }
        }
        rainCameraGPU.invalidate = true;
        this.refreshControls?.();
    },
    transitionDepth(enabled, duration = 4) {
        this.beginContinuousView();
        this.enabled = !!enabled;
        const target = enabled ? 1 : 0;
        if (this.perspective === target && !this.depthTransition) { this.refreshControls?.(); return; }
        // Keep the original viewpoint and motion mode during the morph.
        this.depthTransition = {from:this.perspective,to:target,elapsed:0,duration};
        this.refreshControls?.();
    },
    settleMotion() { this.motionFade = {from: this.motionGain, to: 0, elapsed: 0}; },
    resumeMotion(mode) {
        this.setMode(mode); this.motionGain = 0;
        this.motionFade = {from: 0, to: 1, elapsed: 0};
    },
    advanceTransitions(dt) {
        const ease = t => t*t*t*(t*(t*6-15)+10);
        const depth = this.depthTransition;
        if (depth) {
            depth.elapsed = Math.min(depth.duration, depth.elapsed + dt);
            this.perspective=depth.from+(depth.to-depth.from)*ease(depth.elapsed/depth.duration);
            if (depth.elapsed === depth.duration) this.depthTransition = null;
        }
        const motion = this.motionFade;
        if (motion) {
            motion.elapsed = Math.min(2, motion.elapsed + dt);
            this.motionGain = motion.from + (motion.to-motion.from)*ease(motion.elapsed/2);
            if (motion.elapsed === 2) this.motionFade = null;
        }
    },
    pending: [], bounds: null, streams: new Map(), volume: null, tiles: [], near: 40, far: 2000,
    wrap(value, span, minimum = -span / 2) {
        return minimum + ((value - minimum) % span + span) % span;
    },
    setEnabled(enabled, immediate = false) {
        // The first manual toggle must use the same morph as Auto scenes.
        // Imports/Reset may explicitly replace the projection immediately.
        if (!immediate && (this.continuous || this.enabled !== !!enabled)) {
            this.transitionDepth(enabled); return;
        }
        const changed = this.enabled !== !!enabled;
        this.enabled = !!enabled; this.lastTime = null;
        if (changed) {
            // Re-enter the world from the current heads, not stale flat-view
            // deltas. Existing marks retain their birth colors and lifetimes.
            this.streams.clear();
            matrixCtx.save(); matrixCtx.globalAlpha = 1; matrixCtx.fillStyle = '#000';
            matrixCtx.clearRect(0, 0, matrixCanvas.width, matrixCanvas.height); matrixCtx.restore();
        }
        if (!this.enabled) {
            rainCameraGPU.hide();
            if (['toward','away'].includes(MatrixRainEngine.rainConfig.direction)) {
                document.getElementById('rainDirection').value = ['up','down','left','right'].includes(rainMotion.planar) ? rainMotion.planar : 'down';
                updateRainDirection();
            }
        }
        if (changed && typeof recomputeActiveColumnsMask === 'function') recomputeActiveColumnsMask();
        window.RainMediaCharacters?.refresh?.();
        this.refreshControls?.();
    },
    setMode(mode) {
        if (!window.RainCameraMotion.modes.includes(mode)) return;
        this.mode = mode; this.orbit = mode === 'showcase'; this.motionTime = 0; this.lastTime = null;
        this.motionGain = 1; this.motionFade = null;
        this.motionBase = {yaw: this.yaw, pitch: this.pitch, roll: this.roll};
        this.refreshControls?.();
    },
    viewRotation() {
        const radians = Math.PI / 180;
        return window.RainCameraMotion.rotation(this.yaw * radians, this.pitch * radians, this.roll * radians);
    },
    unwrapStep(delta, span, sign) {
        if (Math.abs(delta) < 1e-7) return 0;
        // Direction disambiguates a large glyph step across a small viewport.
        return (((delta * sign) % span + span) % span) * sign;
    },
    ensureVolume() {
        const width = matrixCanvas.width, height = matrixCanvas.height;
        if (this.volume && this.volume.width === width && this.volume.height === height) return;
        // One lattice for every glyph and every direction. Font and depth do
        // not resize it. A viewport resize starts a new consistent lattice.
        // The default source seeds most depths within about 600 world units.
        // A focal-length repeat fills that depth layer around the camera,
        // rather than repeating a mostly empty 1,937-unit chamber.
        this.volume = { width, height, x: width + 160, y: height + 160,
            z: rainFocalLength, zMin: rainFocalLength / 8 };
        this.streams.clear(); this.marks.length = 0; this.pending.length = 0;
        if (typeof rainCameraGPU !== 'undefined') rainCameraGPU.invalidate = true;
    },
    capture(char, x, y, depth, fontSize, alpha, color, streamId, headOverride = null) {
        this.ensureVolume();
        if (!this.active) depth = rainFocalLength;
        const scale = rainFocalLength / depth, box = this.volume;
        const head = headOverride || (Number.isInteger(streamId) && rainMotion.drops[streamId]);
        const appearanceId = headOverride?.sourceId ?? streamId;
        const hx = head ? head.x : x, hy = head ? head.y : y;
        const raw = { x: (hx - matrixCanvas.width / 2) / scale,
            y: (hy - matrixCanvas.height / 2) / scale, z: depth };
        let position = raw;
        if (head) {
            let stream = this.streams.get(streamId);
            if (!stream || this.frame - stream.frame > 40) {
                stream = { x: raw.x, y: raw.y, z: raw.z, raw, frame: this.frame, delta: [0, 0, 0] };
                this.streams.set(streamId, stream);
            } else {
                const direction = head.lastStepDirection || window.rainAllDirections?.directionFor(streamId, this.active) || MatrixRainEngine.rainConfig.direction;
                let dx = raw.x - stream.raw.x, dy = raw.y - stream.raw.y, dz = raw.z - stream.raw.z;
                // Undo the original screen-loop seam, then wrap once in the
                // fixed world lattice. This preserves the existing head step.
                if (direction === 'toward' || direction === 'away') dz = this.wrap(dz, rainFocalLength / .25 - rainFocalLength / 8);
                else if (direction === 'left' || direction === 'right') dx = this.unwrapStep(dx, (box.width + fontSize * 16) / scale, (direction === 'left' ? -1 : 1) * reverseFlowMultiplier);
                else dy = this.unwrapStep(dy, (box.height + fontSize * 16) / scale, (direction === 'up' ? -1 : 1) * reverseFlowMultiplier);
                if (stream.frame !== this.frame) stream.delta = [dx, dy, dz];
                stream.x += dx; stream.y += dy; stream.z += dz;
                stream.raw = raw; stream.frame = this.frame;
            }
            position = stream;
        }
        // Pattern offsets remain attached to their stream. Historical glyphs
        // never move when the head changes direction or crosses a box face.
        const mark = { char,
            x: this.wrap(position.x + (x - hx) / scale, box.x),
            y: this.wrap(position.y + (y - hy) / scale, box.y),
            z: this.wrap(position.z, box.z, box.zMin),
            fontSize, alpha, color, frame: this.frame, streamId,
            appearanceId, trailLength: window.matrixRainTrails?.lengthFor(appearanceId) ?? 40,
            delta: position.delta || [0, 0, 0] };
        // Capture color now. Uploading, aging, font changes and palette
        // changes must never recolor a character that already exists.
        const palette = window.rainAudioPalette;
        if (palette?.active) {
            const tone = ((Number(appearanceId)||0)*.618033988749895%1+1)%1;
            mark.rgb = Object.freeze(palette.colorA.map((value, channel) => value + (palette.colorB[channel]-value)*tone));
        }
        if(window.rainCloud?.capture?.(mark,this))return;
        this.marks.push(mark); this.pending.push(mark);
    },
    prepareView() {
        this.ensureVolume();
        // The repeating world is unchanged while the camera stands still.
        const pad = Math.max(150, (this.bounds?.pad || 0) + (this.bounds?.motionMargin || 0));
        const cached = this._viewState;
        if (cached && cached.volume === this.volume && cached.yaw === this.yaw
            && cached.pitch === this.pitch && cached.roll === this.roll && cached.near === this.near && cached.far === this.far && cached.pad === pad && cached.perspective === this.perspective) return;
        this._viewState = { volume: this.volume, yaw: this.yaw, pitch: this.pitch, roll: this.roll, near: this.near, far: this.far, pad, perspective: this.perspective };
        this.rotation = this.viewRotation();
        const box = this.volume;
        const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
        // Inverse-project all frustum corners to select whatever cells this
        // orientation needs, including behind the original viewing direction.
        for (const z of [this.near, this.far]) for (const xs of [-1, 1]) for (const ys of [-1, 1]) {
            const x = xs * (box.width / 2 * this.projectionDepth(z) / rainFocalLength + pad);
            const y = ys * (box.height / 2 * this.projectionDepth(z) / rainFocalLength + pad);
            const dz = z - rainFocalLength;
            // Transpose the complete orthonormal rotation, including roll.
            // Tile selection and GPU projection must describe the same view.
            const r = this.rotation;
            const world = [r[0] * x + r[3] * y + r[6] * dz,
                r[1] * x + r[4] * y + r[7] * dz,
                r[2] * x + r[5] * y + r[8] * dz + rainFocalLength];
            for (let axis = 0; axis < 3; axis++) { min[axis] = Math.min(min[axis], world[axis]); max[axis] = Math.max(max[axis], world[axis]); }
        }
        const spans = [box.x, box.y, box.z], base = [0, 0, box.zMin + box.z / 2];
        const lo = min.map((value, axis) => Math.ceil((value - base[axis] - spans[axis] / 2) / spans[axis]));
        const hi = max.map((value, axis) => Math.floor((value - base[axis] + spans[axis] / 2) / spans[axis]));
        const r = this.rotation, sx = box.width / (2 * rainFocalLength), syf = box.height / (2 * rainFocalLength);
        const mix = this.continuous ? this.perspective : 1;
        const px = pad + box.width / 2 * (1-mix), py = pad + box.height / 2 * (1-mix);
        const planes = [[1, 0, sx*mix, px], [-1, 0, sx*mix, px], [0, 1, syf*mix, py], [0, -1, syf*mix, py], [0, 0, 1, -this.near], [0, 0, -1, this.far]];
        const half = spans.map(span => span / 2), tiles = [];
        for (let ix = lo[0]; ix <= hi[0]; ix++) for (let iy = lo[1]; iy <= hi[1]; iy++) for (let iz = lo[2]; iz <= hi[2]; iz++) {
            const offset = [ix * box.x, iy * box.y, iz * box.z];
            const center = [offset[0], offset[1], base[2] + offset[2] - rainFocalLength];
            const view = [r[0] * center[0] + r[1] * center[1] + r[2] * center[2],
                r[3] * center[0] + r[4] * center[1] + r[5] * center[2],
                r[6] * center[0] + r[7] * center[1] + r[8] * center[2] + rainFocalLength];
            const outside = planes.some(([a, b, c, d]) => {
                const extent = Math.abs(a * r[0] + b * r[3] + c * r[6]) * half[0]
                    + Math.abs(a * r[1] + b * r[4] + c * r[7]) * half[1]
                    + Math.abs(a * r[2] + b * r[5] + c * r[8]) * half[2];
                return a * view[0] + b * view[1] + c * view[2] + d + extent < 0;
            });
            if (!outside) tiles.push({ offset, depth: view[2] });
        }
        this.tiles = tiles.sort((a, b) => b.depth - a.depth);
    },
    project(mark) {
        // Orbit around the point 500 units ahead of the original camera.
        const dz = mark.z - rainFocalLength;
        const r = this.viewRotation();
        const x = r[0] * mark.x + r[1] * mark.y + r[2] * dz;
        const y = r[3] * mark.x + r[4] * mark.y + r[5] * dz;
        const z = r[6] * mark.x + r[7] * mark.y + r[8] * dz + rainFocalLength;
        if (z <= 25) return null;
        const scale = rainFocalLength / this.projectionDepth(z);
        return { x: matrixCanvas.width / 2 + x * scale,
            y: matrixCanvas.height / 2 + y * scale, size: mark.fontSize * scale, z };
    },
    advanceFrame() {
        this.syncTrailSettings();
        // Compact history in place once per character step, never per repaint.
        if(!this.active || (typeof rainCameraGPU!=='undefined' && (rainCameraGPU.failed || rainCameraGPU.lost))){
            this.pending.length=0;
            if(typeof rainCameraGPU!=='undefined')rainCameraGPU.invalidate=true;
        }
        let write = 0;
        let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity,pad=0,motionMargin=0;
        for (const mark of this.marks) {
            const lifetime=window.matrixRainTrails?.enabled?mark.trailLength:40;
            if (mark.cloudAge===undefined && this.frame-mark.frame>=lifetime) continue;
            this.marks[write++]=mark;
            const px=mark.x-mark.delta[0],py=mark.y-mark.delta[1],pz=mark.z-mark.delta[2];
            x0=Math.min(x0,mark.x,px);y0=Math.min(y0,mark.y,py);z0=Math.min(z0,mark.z,pz);
            x1=Math.max(x1,mark.x,px);y1=Math.max(y1,mark.y,py);z1=Math.max(z1,mark.z,pz);
            pad=Math.max(pad,mark.fontSize*1.6);
            motionMargin=Math.max(motionMargin,Math.abs(mark.delta[0]),Math.abs(mark.delta[1]),Math.abs(mark.delta[2]));
        }
        this.marks.length=write;
        this.bounds=write?{center:[(x0+x1)/2,(y0+y1)/2,(z0+z1)/2],half:[(x1-x0)/2,(y1-y0)/2,(z1-z0)/2],pad,motionMargin}:null;
        this.frame++;
    },
    refreshCloudBounds() {
        let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity,pad=0,motionMargin=0;
        for(const mark of this.marks){
            const px=mark.x-mark.delta[0],py=mark.y-mark.delta[1],pz=mark.z-mark.delta[2];
            x0=Math.min(x0,mark.x,px);y0=Math.min(y0,mark.y,py);z0=Math.min(z0,mark.z,pz);
            x1=Math.max(x1,mark.x,px);y1=Math.max(y1,mark.y,py);z1=Math.max(z1,mark.z,pz);
            pad=Math.max(pad,mark.fontSize*1.6);motionMargin=Math.max(motionMargin,...mark.delta.map(Math.abs));
        }
        this.bounds=this.marks.length?{center:[(x0+x1)/2,(y0+y1)/2,(z0+z1)/2],half:[(x1-x0)/2,(y1-y0)/2,(z1-z0)/2],pad,motionMargin}:null;
    },
    present(now = performance.now(), phase = 1) {
        this.syncTrailSettings();
        window.rainMedia?.present(now);
        const gap=this.lastTime===null?0:Math.max(0,now-this.lastTime);
        const dt=gap>250?0:Math.min(.1,gap/1000);this.lastTime=now;
        this.advanceTransitions(dt);
        window.rainAutoScenes?.advance(dt);
        window.rainCloud?.advance(dt,this,phase);
        if(this.active){
            if(this.mode!=='fixed'){
                this.motionTime+=dt*this.speeds[this.mode]*this.phaseRates[this.mode]*this.motionGain*(this.continuous?this.perspective:1);
                const angles=window.RainCameraMotion.angles(this.mode,this.motionTime),degrees=180/Math.PI;
                for(const axis of ['yaw','pitch','roll'])this[axis]=this.wrap(this.motionBase[axis]+angles[axis]*degrees,360);
                if(now-(this.lastControlUpdate||0)>100){this.refreshControls?.(true);this.lastControlUpdate=now;}
            }
            const quality=window.matrixRainRendering?.quality;
            if(quality==='low'&&this.lastQuality==='low'&&now-(this.lastPaint||0)<1000/30)return;
            this.lastQuality=quality;this.lastPaint=now;
            this.prepareView();rainCameraGPU.render(this,phase);
        }else rainCameraGPU.hide();
        window.rainMedia?.presentFlat(!this.active||rainCameraGPU.failed||rainCameraGPU.lost);
        window.rainSettingsBeacon?.update(now);
    },
    // Diagnostic compatibility: one complete simulation step and presentation.
    syncTrailSettings() {
        const trails = window.matrixRainTrails;
        if (!trails || (this.trailRevision === trails.revision && this.trailVariety === trails.enabled)) return;
        this.trailRevision = trails.revision; this.trailVariety = trails.enabled;
        for (const mark of this.marks) mark.trailLength = trails.lengthFor(mark.appearanceId ?? mark.streamId);
        if (typeof rainCameraGPU !== 'undefined') rainCameraGPU.invalidate = true;
    },
    render() {this.advanceFrame();this.present(performance.now(),1);}

};

window.addEventListener('DOMContentLoaded', () => {
    const panel = document.createElement('div');
    panel.id = 'rain-camera-panel';
    panel.style.cssText = 'border:1px solid #00ff41;padding:12px;margin:12px 0;background:#071009;text-align:left';
    panel.innerHTML = `<strong>3D Camera</strong>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin:10px 0">
        <label><input id="cameraEnabled" type="checkbox"> Enable camera</label>
        <button id="cameraReset" type="button" class="btn">Original View</button></div>
        <small id="cameraViewPolicy" style="display:block;margin-bottom:8px"></small>
        <div role="group" aria-label="Camera movement" style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">
        <button type="button" class="btn" data-camera-mode="fixed">Fixed</button>
        <button type="button" class="btn" data-camera-mode="showcase">Showcase</button>
        <button type="button" class="btn" data-camera-mode="corkscrew">Corkscrew</button>
        <button type="button" class="btn" data-camera-mode="gyroscope">Gyroscope</button></div>
        <label for="cameraSpeed">Motion speed: <span id="cameraSpeedValue">100%</span></label>
        <input id="cameraSpeed" type="range" min="0" max="100" value="100" step="1" style="width:100%">
        <small style="display:block;margin-bottom:10px">All animated modes start at 25%. Equal percentages give comparable view speed; 0% holds the viewpoint.</small>
        <label for="cameraYaw">Look around</label>
        <input id="cameraYaw" type="range" min="-180" max="180" value="0" step="1" style="width:100%">
        <label for="cameraPitch">Look up / down</label>
        <input id="cameraPitch" type="range" min="-180" max="180" value="0" step="1" style="width:100%">
        <label for="cameraRoll">Roll</label>
        <input id="cameraRoll" type="range" min="-180" max="180" value="0" step="1" style="width:100%">`;
    document.getElementById('audioReactiveBtn').parentElement.before(panel);
    const enabled = document.getElementById('cameraEnabled');
    const yaw = document.getElementById('cameraYaw');
    const pitch = document.getElementById('cameraPitch');
    const roll = document.getElementById('cameraRoll');
    const speed = document.getElementById('cameraSpeed');
    try {
        const saved = JSON.parse(localStorage.getItem('matrixRain.preview.calibratedCameraSpeeds') || 'null');
        for (const mode of Object.keys(rainCamera.speeds))
            if (typeof saved?.[mode] === 'number' && Number.isFinite(saved[mode])) rainCamera.speeds[mode] = Math.max(0, Math.min(1, saved[mode]));
    } catch (_) {}
    rainCamera.refreshControls = (onlyVisible = false) => {
        const modal = document.querySelector('.matrix-modal');
        if (onlyVisible && (!modal || modal.classList.contains('minimized') || modal.style.display === 'none')) return;
        enabled.checked = rainCamera.enabled;
        window.rainTrailControls?.refresh();
        yaw.value = rainCamera.yaw; pitch.value = rainCamera.pitch; roll.value = rainCamera.roll;
        speed.disabled = !rainCamera.enabled || rainCamera.mode === 'fixed';
        yaw.disabled = pitch.disabled = roll.disabled = !rainCamera.enabled;
        document.getElementById('cameraViewPolicy').textContent = rainCamera.depthTransition ? 'Changing depth · same rain · retained angle' : rainCamera.continuous && !rainCamera.enabled ? 'Flat projection · uniform fonts · retained roll' : rainCamera.enabled ? '3D view · perspective fonts · six directions' : 'Original view · one font size · four directions';
        for (const button of document.querySelectorAll('[data-control="rainDirection"] [data-value="toward"], [data-control="rainDirection"] [data-value="away"]')) button.disabled = !rainCamera.enabled;
        speed.value = Math.round((rainCamera.speeds[rainCamera.mode] ?? 1) * 100);
        document.getElementById('cameraSpeedValue').textContent = speed.value + '%';
        for (const button of panel.querySelectorAll('[data-camera-mode]')) {
            const active = rainCamera.enabled && button.dataset.cameraMode === rainCamera.mode;
            button.setAttribute('aria-pressed', String(active));
            button.style.outline = active ? '2px solid #00ff41' : '';
        }
    };
    enabled.onchange = () => rainCamera.setEnabled(enabled.checked);
    speed.oninput = () => {
        if (rainCamera.mode === 'fixed') return;
        rainCamera.speeds[rainCamera.mode] = Number(speed.value) / 100;
        try { localStorage.setItem('matrixRain.preview.calibratedCameraSpeeds', JSON.stringify(rainCamera.speeds)); } catch (_) {}
        rainCamera.refreshControls();
    };
    for (const button of panel.querySelectorAll('[data-camera-mode]')) button.onclick = () => {
        rainCamera.setEnabled(true); rainCamera.setMode(button.dataset.cameraMode);
    };
    for (const [axis, input] of [['yaw', yaw], ['pitch', pitch], ['roll', roll]]) input.oninput = () => {
        const value = Number(input.value);
        rainCamera.setMode('fixed'); rainCamera[axis] = value;
        rainCamera.setEnabled(true);
    };
    document.getElementById('cameraReset').onclick = () => {
        rainCamera.setEnabled(false); rainCamera.setMode('fixed');
        rainCamera.yaw = rainCamera.pitch = rainCamera.roll = 0; rainCamera.refreshControls();
        matrixCtx.globalAlpha = 1; matrixCtx.fillStyle = '#000';
        matrixCtx.clearRect(0, 0, matrixCanvas.width, matrixCanvas.height);
    };
    rainCamera.setEnabled(rainCamera.enabled);
});
