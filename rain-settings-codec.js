// Versioned, local-only settings. Decode and validate everything before applying.
(function (root) {
    'use strict';
    const number = (min, max) => ({kind:'number', min, max});
    const integer = (min, max) => ({kind:'number', min, max, integer:true});
    const choice = (...values) => ({kind:'choice', values});
    const text = max => ({kind:'text', max});
    const bool = {kind:'bool'}, hex = {kind:'hex'};
    const schema = {
        v:choice(8), name:text(60),
        rain:{pattern:choice('classic','rainbow','pentad','chaos','harmonic'),
            speed:integer(1,100), intensity:integer(1,100), density:integer(1,100), fontSize:integer(1,100),
            primary:hex, secondary:hex,
            characterSet:choice('matrix','binary','hex','symbols','katakana','custom'),
            customCharacters:text(512), direction:choice('down','up','left','right','toward','away'), reverse:bool},
        audio:{preset:choice('default','neon','prism','pastel','hyperneon','aurora','bassstorm','crystal','vaporwave','inferno','zen'),
            beatTurns:bool, fluctuation:integer(100,500), hueReact:integer(50,200),
            saturationGain:integer(50,200), brightnessDepth:integer(50,200), spread:number(0,4),
            trebleHueRange:number(0,90), saturationFloor:number(0,100), brightnessMin:number(0,100), brightnessMax:number(0,100)},
        camera:{enabled:bool, mode:choice('fixed','showcase','corkscrew','gyroscope'),
            yaw:number(-180,180), pitch:number(-180,180), roll:number(-180,180),
            speeds:{showcase:integer(0,100),corkscrew:integer(0,100),gyroscope:integer(0,100)}},
        render:{quality:choice('balanced','sharp','low'),sharp:bool,smooth:bool,glow:integer(0,100),contrast:integer(75,150)},
        trails:{enabled:bool,stepped:bool,minimum:integer(12,160),maximum:integer(12,160)},
        words:{maxWords:integer(1,5),bufferMs:integer(0,3500),verticalOrder:choice('down','up')},
        media:{influence:integer(0,100),exposure:integer(50,200),contrast:integer(50,200),gamma:integer(50,300),mirror:bool,isolate:bool}
    };
    const previewSchema={motion:choice('original','refined'),color:choice('original','cohesive')};
    const {words:ignoredWords,...schema6}=schema;
    const {media:ignoredMedia,...oldSchema}=schema6;
    const legacy7Schema={...schema,v:choice(7),words:{maxWords:schema.words.maxWords,bufferMs:schema.words.bufferMs}};
    const legacy6Schema={...schema6,v:choice(6)};
    const legacyMedia={influence:schema.media.influence,exposure:schema.media.exposure,contrast:schema.media.contrast,mirror:bool};
    const legacy4Schema={...schema6,v:choice(4),media:{...legacyMedia,glints:bool}};
    const legacy5Schema={...schema6,v:choice(5),media:legacyMedia};
    const legacy3Schema={...oldSchema,v:choice(3)};
    const legacy2Schema={...oldSchema,v:choice(2),preview:previewSchema};
    const legacySchema={...legacy2Schema,v:choice(1),audio:{...schema.audio,depth:bool}};
    function check(value, rule, path) {
        const fail = () => {throw Error('Invalid setting: '+path);};
        if (rule.kind) {
            if (rule.kind==='number' && !(typeof value==='number' && Number.isFinite(value) && value>=rule.min && value<=rule.max)) fail();
            if (rule.integer && !Number.isInteger(value)) fail();
            if (rule.kind==='bool' && typeof value!=='boolean') fail();
            if (rule.kind==='text' && !(typeof value==='string' && Array.from(value).length<=rule.max)) fail();
            if (rule.kind==='hex' && !(typeof value==='string' && /^#[0-9a-f]{6}$/i.test(value))) fail();
            if (rule.kind==='choice' && !rule.values.includes(value)) fail();
            return value;
        }
        if (!value || typeof value!=='object' || Array.isArray(value)) fail();
        const keys=Object.keys(rule);
        if (Object.keys(value).length!==keys.length || Object.keys(value).some(k=>!Object.hasOwn(rule,k))) fail();
        const clean={};
        for (const key of keys) clean[key]=check(value[key],rule[key],path?path+'.'+key:key);
        return clean;
    }
    function validate(settings) {
        // MR1 had an independent depth flag. Camera is now authoritative.
        // Validate the complete old schema before migrating it.
        if ([1,2,3].includes(settings?.v)) {
            settings=check(settings,settings.v===1?legacySchema:settings.v===2?legacy2Schema:legacy3Schema,'');
            if(settings.v===1)delete settings.audio.depth;
            delete settings.preview;
            settings.v=6;settings.media={influence:100,exposure:100,contrast:100,gamma:100,mirror:false,isolate:true};
            if (!settings.camera.enabled && ['toward','away'].includes(settings.rain.direction)) settings.rain.direction='down';
        }
        if(settings?.v===4||settings?.v===5){settings=check(settings,settings.v===4?legacy4Schema:legacy5Schema,'');delete settings.media.glints;settings.media.gamma=100;settings.media.isolate=true;settings.v=6;}
        if(settings?.v===6){settings=check(settings,legacy6Schema,'');settings.words={maxWords:3,bufferMs:1900};settings.v=7;}
        if(settings?.v===7){settings=check(settings,legacy7Schema,'');settings.words.verticalOrder='down';settings.v=8;}
        const clean=check(settings,schema,'');
        if (clean.trails.minimum>clean.trails.maximum) throw Error('Shortest trail exceeds longest trail.');
        if (clean.audio.brightnessMin>clean.audio.brightnessMax) throw Error('Invalid brightness range.');
        if (clean.rain.characterSet==='custom' && !clean.rain.customCharacters.trim()) throw Error('Custom characters are empty.');
        if (!clean.camera.enabled && ['toward','away'].includes(clean.rain.direction)) throw Error('Toward/away needs Camera enabled.');
        return clean;
    }
    function encode(settings) {
        const bytes=new TextEncoder().encode(JSON.stringify(validate(settings)));
        let binary='';for (const byte of bytes) binary+=String.fromCharCode(byte);
        return 'MR8.'+btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    }
    function decode(blob) {
        if (typeof blob!=='string' || blob.length>24000) throw Error('Configuration is too large.');
        const compact=blob.replace(/[\t\r\n ]/g,'');
        if (!/^MR[12345678]\./.test(compact)) throw Error('Expected a Matrix Rain configuration.');
        const payload=compact.slice(4);
        if (!payload || payload.length>12000 || !/^[A-Za-z0-9_-]+$/.test(payload) || payload.length%4===1) throw Error('Damaged configuration.');
        let parsed;
        try {
            const binary=atob(payload.replace(/-/g,'+').replace(/_/g,'/'));
            const json=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(binary,c=>c.charCodeAt(0)));
            parsed=JSON.parse(json);
        } catch (_) {throw Error('Damaged configuration.');}
        if (parsed?.v!==Number(compact[2])) throw Error('Configuration version does not match its code.');
        return validate(parsed);
    }
    function paths(rule=schema,prefix='') {
        if(rule.kind)return [prefix];
        return Object.entries(rule).flatMap(([key,value])=>paths(value,prefix?prefix+'.'+key:key));
    }
    const api={encode,decode,validate,paths:()=>paths(),schema};
    if (typeof module!=='undefined' && module.exports) module.exports=api;
    root.RainSettingsCodec=api;
})(typeof window==='undefined'?globalThis:window);
