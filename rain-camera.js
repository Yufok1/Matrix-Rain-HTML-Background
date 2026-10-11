// The 3D camera is enabled by default; Original View restores the base renderer.
const rainCamera = {
    enabled: true, orbit: false, yaw: 0, pitch: 0, frame: 0, marks: [], lastTime: 0,
    streams: new Map(), volume: null, tiles: [], near: 40, far: 2000,
    wrap(value, span, minimum = -span / 2) {
        return minimum + ((value - minimum) % span + span) % span;
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
        this.streams.clear(); this.marks.length = 0;
    },
    capture(char, x, y, depth, fontSize, alpha, color, streamId) {
        this.ensureVolume();
        const scale = rainFocalLength / depth, box = this.volume;
        const head = Number.isInteger(streamId) && rainMotion.drops[streamId];
        const hx = head ? head.x : x, hy = head ? head.y : y;
        const raw = { x: (hx - matrixCanvas.width / 2) / scale,
            y: (hy - matrixCanvas.height / 2) / scale, z: depth };
        let position = raw;
        if (head) {
            let stream = this.streams.get(streamId);
            if (!stream || this.frame - stream.frame > 40) {
                stream = { x: raw.x, y: raw.y, z: raw.z, raw, frame: this.frame };
                this.streams.set(streamId, stream);
            } else {
                const direction = MatrixRainEngine.rainConfig.direction;
                let dx = raw.x - stream.raw.x, dy = raw.y - stream.raw.y, dz = raw.z - stream.raw.z;
                // Undo the original screen-loop seam, then wrap once in the
                // fixed world lattice. This preserves the existing head step.
                if (direction === 'toward' || direction === 'away') dz = this.wrap(dz, rainFocalLength / .25 - rainFocalLength / 8);
                else if (direction === 'left' || direction === 'right') dx = this.unwrapStep(dx, (box.width + fontSize * 16) / scale, (direction === 'left' ? -1 : 1) * reverseFlowMultiplier);
                else dy = this.unwrapStep(dy, (box.height + fontSize * 16) / scale, (direction === 'up' ? -1 : 1) * reverseFlowMultiplier);
                stream.x += dx; stream.y += dy; stream.z += dz;
                stream.raw = raw; stream.frame = this.frame;
            }
            position = stream;
        }
        // Pattern offsets remain attached to their stream. Historical glyphs
        // never move when the head changes direction or crosses a box face.
        this.marks.push({ char,
            x: this.wrap(position.x + (x - hx) / scale, box.x),
            y: this.wrap(position.y + (y - hy) / scale, box.y),
            z: this.wrap(position.z, box.z, box.zMin),
            fontSize, alpha, color, frame: this.frame, streamId,
            trailLength: window.matrixRainTrails?.lengthFor(streamId) ?? 40 });
    },
    prepareView() {
        this.ensureVolume();
        const yaw = this.yaw * Math.PI / 180, pitch = this.pitch * Math.PI / 180;
        const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
        this.rotation = [cy, 0, -sy, -sp * sy, cp, -sp * cy, cp * sy, sp, cp * cy];
        const box = this.volume, pad = 150;
        const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
        // Inverse-project all frustum corners to select whatever cells this
        // orientation needs, including behind the original viewing direction.
        for (const z of [this.near, this.far]) for (const xs of [-1, 1]) for (const ys of [-1, 1]) {
            const x = xs * (box.width / 2 * z / rainFocalLength + pad);
            const y = ys * (box.height / 2 * z / rainFocalLength + pad);
            const dz = z - rainFocalLength;
            const wy = cp * y + sp * dz, z1 = -sp * y + cp * dz;
            const world = [cy * x + sy * z1, wy, -sy * x + cy * z1 + rainFocalLength];
            for (let axis = 0; axis < 3; axis++) { min[axis] = Math.min(min[axis], world[axis]); max[axis] = Math.max(max[axis], world[axis]); }
        }
        const spans = [box.x, box.y, box.z], base = [0, 0, box.zMin + box.z / 2];
        const lo = min.map((value, axis) => Math.ceil((value - base[axis] - spans[axis] / 2) / spans[axis]));
        const hi = max.map((value, axis) => Math.floor((value - base[axis] + spans[axis] / 2) / spans[axis]));
        const r = this.rotation, sx = box.width / (2 * rainFocalLength), syf = box.height / (2 * rainFocalLength);
        const planes = [[1, 0, sx, pad], [-1, 0, sx, pad], [0, 1, syf, pad], [0, -1, syf, pad], [0, 0, 1, -this.near], [0, 0, -1, this.far]];
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
        const yaw = this.yaw * Math.PI / 180, pitch = this.pitch * Math.PI / 180;
        // Orbit around the point 500 units ahead of the original camera.
        const dz = mark.z - rainFocalLength;
        const x = Math.cos(yaw) * mark.x - Math.sin(yaw) * dz;
        const z1 = Math.sin(yaw) * mark.x + Math.cos(yaw) * dz;
        const y = Math.cos(pitch) * mark.y - Math.sin(pitch) * z1;
        const z = Math.sin(pitch) * mark.y + Math.cos(pitch) * z1 + rainFocalLength;
        if (z <= 25) return null;
        const scale = rainFocalLength / z;
        return { x: matrixCanvas.width / 2 + x * scale,
            y: matrixCanvas.height / 2 + y * scale, size: mark.fontSize * scale, z };
    },
    render() {
        const now = performance.now();
        const dt = this.lastTime ? Math.min(0.1, (now - this.lastTime) / 1000) : 0;
        this.lastTime = now;
        this.marks = this.marks.filter(mark => this.frame - mark.frame < (window.matrixRainTrails?.enabled ? mark.trailLength : 40));
        if (this.enabled) {
            if (this.orbit) {
                this.yaw = ((this.yaw + dt * 8 + 180) % 360) - 180;
                document.getElementById('cameraYaw').value = this.yaw;
            }
            this.prepareView();
            rainCameraGPU.render(this);
        } else rainCameraGPU.hide();
        this.frame++;
    }
};

window.addEventListener('DOMContentLoaded', () => {
    const panel = document.createElement('div');
    panel.style.cssText = 'border:1px solid #00ff41;padding:12px;margin:12px 0;background:#071009';
    panel.innerHTML = `<strong>3D Camera</strong>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin:10px 0">
        <label><input id="cameraEnabled" type="checkbox"> Enable camera</label>
        <label><input id="cameraOrbit" type="checkbox"> Slow orbit</label>
        <button id="cameraReset" type="button" class="btn">Original View</button></div>
        <label for="cameraYaw">Look around</label>
        <input id="cameraYaw" type="range" min="-180" max="180" value="0" step="1" style="width:100%">
        <label for="cameraPitch">Look up / down</label>
        <input id="cameraPitch" type="range" min="-85" max="85" value="0" step="1" style="width:100%">`;
    document.getElementById('audioReactiveBtn').parentElement.before(panel);
    const enabled = document.getElementById('cameraEnabled');
    const orbit = document.getElementById('cameraOrbit');
    const yaw = document.getElementById('cameraYaw');
    const pitch = document.getElementById('cameraPitch');
    enabled.checked = rainCamera.enabled;
    enabled.onchange = () => { rainCamera.enabled = enabled.checked; };
    orbit.onchange = () => { rainCamera.orbit = orbit.checked; if (orbit.checked) rainCamera.enabled = enabled.checked = true; };
    yaw.oninput = () => { rainCamera.yaw = Number(yaw.value); rainCamera.enabled = enabled.checked = true; };
    pitch.oninput = () => { rainCamera.pitch = Number(pitch.value); rainCamera.enabled = enabled.checked = true; };
    document.getElementById('cameraReset').onclick = () => {
        rainCamera.enabled = rainCamera.orbit = enabled.checked = orbit.checked = false;
        rainCamera.yaw = rainCamera.pitch = 0; yaw.value = pitch.value = 0;
        matrixCtx.globalAlpha = 1; matrixCtx.fillStyle = '#000';
        matrixCtx.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);
    };
});
