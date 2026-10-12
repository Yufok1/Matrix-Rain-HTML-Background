const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'matrix-rain-utility-suite.html'), 'utf8');
assert.equal(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), main,
    'The live preview must match the main application; run npm run sync-demo');

let inlineScripts = 0;
const assets = new Set();
for (const [, attributes, body] of main.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const source = attributes.match(/\bsrc=["']([^"']+)["']/)?.[1];
    if (source) {
        assert.doesNotMatch(source, /^(?:[a-z]+:|\/)/i, 'Scripts are bundled local files');
        const file = path.resolve(root, source);
        assert.ok(file.startsWith(root + path.sep), 'Runtime scripts stay inside the project');
        assert.ok(fs.existsSync(file), 'Missing runtime file: ' + source);
        assets.add(source);
        if (!/\btype=["']module["']/.test(attributes)) new vm.Script(fs.readFileSync(file, 'utf8'), {filename: source});
    } else {
        new vm.Script(body, {filename: 'inline-script-' + (++inlineScripts)});
    }
}
assert.equal(inlineScripts, 1);
assert.deepEqual([...assets].sort(), ['assets/rain-font-msdf.js', 'rain-animation-clock.js', 'rain-audio-motion.js', 'rain-camera-gpu.js', 'rain-camera-motion.js', 'rain-camera.js', 'rain-color-fluctuation.js', 'render-settings.js', 'settings-panel.js', 'trails/rain-trails.js']);
const trails = fs.readFileSync(path.join(root, 'trails/rain-trails.js'), 'utf8');
for (const [, imported] of trails.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
    assert.ok(fs.existsSync(path.resolve(root, 'trails', imported)), 'Missing trail module: ' + imported);
}
assert.match(main, /id="rainDensity"[^>]*value="50"/);
assert.match(main, /density:\s*50\b/);
assert.match(fs.readFileSync(path.join(root, 'rain-camera.js'), 'utf8'), /enabled:\s*true,\s*orbit:\s*false/);
assert.doesNotMatch(main, /matrixSpeech|speech\/rain-speech|data-speech-test/);
for (const name of ['matrix-rain-utility-suite.html', 'rain-camera.js', 'rain-camera-motion.js', 'rain-color-fluctuation.js'])
    assert.doesNotMatch(fs.readFileSync(path.join(root, name), 'utf8'), /DeviceOrientation|DeviceMotion|navigator\.geolocation|GenericSensor|Gyroscope\(/, 'PC builds contain no device-sensor route');
assert.doesNotMatch(main, /<(select|option)\b/i, 'Preserve the CEF-safe settings controls');
assert.match(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), /https:\/\/yufok1\.github\.io\/Matrix-Rain-HTML-Background\//);
console.log('Demo parity, bundled runtime paths, script syntax, release defaults, and settings guards passed.');
