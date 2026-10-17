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
        const file = path.resolve(root, source.split('?')[0]);
        assert.ok(file.startsWith(root + path.sep), 'Runtime scripts stay inside the project');
        assert.ok(fs.existsSync(file), 'Missing runtime file: ' + source);
        assets.add(source.split('?')[0]);
        if (!/\btype=["']module["']/.test(attributes)) new vm.Script(fs.readFileSync(file, 'utf8'), {filename: source});
    } else {
        new vm.Script(body, {filename: 'inline-script-' + (++inlineScripts)});
    }
}
assert.equal(inlineScripts, 1);
assert.deepEqual([...assets].sort(), ["rain-auto-scenes.js", "assets/rain-font-msdf.js", "assets/media-characters.js", "rain-media-characters.js", "beat-turns-policy.js", "choreography-preview.js", "color-preview.js", "rain-animation-clock.js", "rain-audio-characters.js", "rain-audio-choreography.js", "rain-audio-color.js", "rain-audio-motion.js", "rain-camera-gpu.js", "rain-camera-motion.js", "rain-camera.js", "rain-color-fluctuation.js", "rain-media-assembly.js", "rain-media-depiction.js", "rain-session-controls.js", "rain-settings-codec.js", "rain-settings-share.js", "rain-settings-ui.js", "rain-all-directions.js", "render-settings.js", "settings-panel.js", "rain-tab-audio.js"].sort());
const trails = fs.readFileSync(path.join(root, 'trails/rain-trails.js'), 'utf8');
for (const [, imported] of trails.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
    assert.ok(fs.existsSync(path.resolve(root, 'trails', imported.split('?')[0])), 'Missing trail module: ' + imported);
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

assert.doesNotMatch(main, /<script[^>]+src="trails\/rain-trails\.js/, "Trail state is initialized once, through the settings module dependency");

assert.match(main,/id="characterSet" value="katakana"/);
assert.match(main,/characterSet:\s*'katakana'/);
assert.match(fs.readFileSync(path.join(root,'rain-settings-share.js'),'utf8'),/characterSet:'katakana',customCharacters:''/);

const crypto=require('node:crypto');
for(const [parent,dependency]of [['trails/rain-trails.js','trails/rain-trail-lengths.js'],['rain-settings-ui.js','trails/rain-trails.js']]){
    const digest=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,dependency),'utf8').replace(/\r\n/g,'\n')).digest('hex').slice(0,12);
    assert.ok(fs.readFileSync(path.join(root,parent),'utf8').includes(path.basename(dependency)+'?v='+digest),'Cached dependency URL must match '+dependency);
}


for(const name of ['rain-media-depiction.js','rain-media-assembly.js','rain-camera-gpu.js']){
    assert.doesNotMatch(fs.readFileSync(path.join(root,name),'utf8'),/getUserMedia|enumerateDevices|startCamera|nextCamera|mediaCamera|media-camera|media-mirror|media-isolate|mediapipe|person-worker/,
        'Web builds retain video/image/tab depiction without camera capture or isolation');
}
assert.ok(!fs.existsSync(path.join(root,'rain-media-person-worker.js')));
assert.ok(!fs.existsSync(path.join(root,'vendor/mediapipe')));

// The browser bundle must contain no recognition worker or model-download route.
for(const name of ['rain-media-words.js','rain-video-words.js','rain-timed-words-worker.js','rain-word-reading.js','rain-word-timeline.js','vendor/canvas5/words.js','vendor/speech'])assert.ok(!fs.existsSync(path.join(root,name)),'Removed speech asset still present: '+name);
for(const file of [...assets,'rain-settings-ui.js','rain-settings-beacon.js'])assert.doesNotMatch(fs.readFileSync(path.join(root,file),'utf8'),/SpeechRecognition|rainMediaWords|rainVideoWords|connectSpeech|setWordSync|whisper|transformers|onnx/i,'No recognition or model-download runtime remains: '+file);
