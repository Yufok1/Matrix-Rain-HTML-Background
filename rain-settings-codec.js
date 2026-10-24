// Versioned, local-only settings. Decode and validate everything before applying.
(function (root) {
    'use strict';
    const number = (min, max) => ({kind:'number', min, max});
    const integer = (min, max) => ({kind:'number', min, max, integer:true});
    const choice = (...values) => ({kind:'choice', values});
    const text = max => ({kind:'text', max});
    const bool = {kind:'bool'}, hex = {kind:'hex'};
    const legacy10Schema = {
        v:choice(10), name:text(60),
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
        media:{influence:integer(0,100),exposure:integer(50,200),contrast:integer(50,200),gamma:integer(50,300)}
    };
    const legacy11Schema={...legacy10Schema,v:choice(11),
        rain:{...legacy10Schema.rain,flow:choice('directed','crossflow')},
        media:{...legacy10Schema.media,characters:choice('original','shading','braille','lines'),dotDensity:integer(0,100)}};
    const legacy12Schema={...legacy11Schema,v:choice(12),rain:{...legacy11Schema.rain,flow:choice('directed','crossflow','counterflow')}};
    const legacy13Schema={...legacy12Schema,v:choice(13),audio:{...legacy12Schema.audio,flowFollow:bool}};
    const legacy14Schema={...legacy12Schema,v:choice(14)};
    const legacy15Schema={...legacy14Schema,v:choice(15),camera:{...legacy14Schema.camera,continuous:bool},auto:{interval:integer(1,60)}};
    const schema={...legacy15Schema,v:choice(16),auto:{interval:number(.1,60)}};
    const pool=(...keys)=>({change:bool,allowed:Object.fromEntries(keys.map(k=>[k,bool]))});
    const range=(min,max)=>({change:bool,min:integer(min,max),max:integer(min,max)});
    const programSchema={order:choice('random','sequence'),
        appearances:{rain:{enabled:bool,min:number(.1,60),max:number(.1,60)},cloud:{enabled:bool,min:number(.1,60),max:number(.1,60)}},
        camera:pool('flat','fixed','showcase','corkscrew','gyroscope'),flow:pool('directed','counterflow','crossflow'),
        characters:pool('katakana','matrix','binary','hex','symbols','custom'),direction:pool('down','right','up','left','toward','away'),
        size:range(14,25),density:range(1,100),speed:range(21,71),colors:bool,trails:bool,clarity:bool};
    const schema17={...schema,v:choice(17),auto:{interval:number(.1,60),program:programSchema}};
    function programDefaults(){
        const allowed=(keys)=>({change:true,allowed:Object.fromEntries(keys.map(k=>[k,true]))});
        return {order:'random',appearances:{rain:{enabled:true,min:12,max:12},cloud:{enabled:false,min:5,max:5}},
            camera:allowed(['flat','fixed','showcase','corkscrew','gyroscope']),flow:allowed(['directed','counterflow','crossflow']),
            characters:{change:true,allowed:{katakana:true,matrix:true,binary:true,hex:true,symbols:true,custom:false}},
            direction:allowed(['down','right','up','left','toward','away']),size:{change:true,min:14,max:20},
            density:{change:true,min:20,max:78},speed:{change:true,min:21,max:71},colors:true,trails:true,clarity:true};
    }
    function validateProgram(value){
        const clean=check(value,programSchema,'auto.program');
        if(!Object.values(clean.appearances).some(v=>v.enabled))throw Error('Choose at least one appearance.');
        for(const [key,r]of Object.entries({...clean.appearances,size:clean.size,density:clean.density,speed:clean.speed}))if(r.min>r.max)throw Error('Minimum exceeds maximum: '+key);
        for(const key of ['camera','flow','characters','direction'])if(!Object.values(clean[key].allowed).some(Boolean))throw Error('Choose at least one '+key+' mode.');
        return clean;
    }
    const previewSchema={motion:choice('original','refined'),color:choice('original','cohesive')};
    const legacyWords={maxWords:integer(1,5),bufferMs:integer(0,3500),verticalOrder:choice('down','up')};
    const legacy9Schema={...legacy10Schema,v:choice(9),words:legacyWords};
    const legacy8Schema={...legacy9Schema,v:choice(8),media:{...legacy10Schema.media,mirror:bool,isolate:bool}};
    const {words:ignoredWords,...schema6}=legacy8Schema;
    const {media:ignoredMedia,...oldSchema}=schema6;
    const legacy7Schema={...legacy8Schema,v:choice(7),words:{maxWords:legacyWords.maxWords,bufferMs:legacyWords.bufferMs}};
    const legacy6Schema={...schema6,v:choice(6)};
    const legacyMedia={influence:schema.media.influence,exposure:schema.media.exposure,contrast:schema.media.contrast,mirror:bool};
    const legacy4Schema={...schema6,v:choice(4),media:{...legacyMedia,glints:bool}};
    const legacy5Schema={...schema6,v:choice(5),media:legacyMedia};
    const legacy3Schema={...oldSchema,v:choice(3)};
    const legacy2Schema={...oldSchema,v:choice(2),preview:previewSchema};
    const legacySchema={...legacy2Schema,v:choice(1),audio:{...legacy10Schema.audio,depth:bool}};
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
        if(settings?.v===8){settings=check(settings,legacy8Schema,'');delete settings.media.mirror;delete settings.media.isolate;settings.v=9;}
        if(settings?.v===9){settings=check(settings,legacy9Schema,'');delete settings.words;settings.v=10;}
        if(settings?.v===10){settings=check(settings,legacy10Schema,'');settings.rain.flow='directed';settings.media.characters='original';settings.media.dotDensity=50;settings.v=11;}
        if(settings?.v===11){settings=check(settings,legacy11Schema,'');settings.v=12;}
        if(settings?.v===12){settings=check(settings,legacy12Schema,'');settings.audio.flowFollow=false;settings.v=13;}
        if(settings?.v===13){settings=check(settings,legacy13Schema,'');delete settings.audio.flowFollow;settings.v=14;}
        if(settings?.v===14){settings=check(settings,legacy14Schema,'');settings.camera.continuous=false;settings.auto={interval:12};settings.v=15;}
        if(settings?.v===15){settings=check(settings,legacy15Schema,'');settings.v=16;}
        const clean=check(settings,settings?.v===17?schema17:schema,'');
        if(clean.v===17)clean.auto.program=validateProgram(clean.auto.program);
        if (clean.trails.minimum>clean.trails.maximum) throw Error('Shortest trail exceeds longest trail.');
        if (clean.audio.brightnessMin>clean.audio.brightnessMax) throw Error('Invalid brightness range.');
        if (clean.rain.characterSet==='custom' && !clean.rain.customCharacters.trim()) throw Error('Custom characters are empty.');
        if (!clean.camera.enabled && !clean.camera.continuous && ['toward','away'].includes(clean.rain.direction)) throw Error('Toward/away needs Camera enabled.');
        return clean;
    }
    function encode(settings) {
        const clean=validate(settings),bytes=new TextEncoder().encode(JSON.stringify(clean));
        let binary='';for (const byte of bytes) binary+=String.fromCharCode(byte);
        return 'MR'+clean.v+'.'+btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    }
    function decode(blob) {
        if (typeof blob!=='string' || blob.length>24000) throw Error('Configuration is too large.');
        const compact=blob.replace(/[\t\r\n ]/g,'');
        const prefix=compact.match(/^MR(17|16|15|14|13|12|11|10|[1-9])\./);
        if (!prefix) throw Error('Expected a Matrix Rain configuration.');
        const payload=compact.slice(prefix[0].length);
        if (!payload || payload.length>12000 || !/^[A-Za-z0-9_-]+$/.test(payload) || payload.length%4===1) throw Error('Damaged configuration.');
        let parsed;
        try {
            const binary=atob(payload.replace(/-/g,'+').replace(/_/g,'/'));
            const json=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(binary,c=>c.charCodeAt(0)));
            parsed=JSON.parse(json);
        } catch (_) {throw Error('Damaged configuration.');}
        if (parsed?.v!==Number(prefix[1])) throw Error('Configuration version does not match its code.');
        return validate(parsed);
    }
    function paths(rule=schema,prefix='') {
        if(rule.kind)return [prefix];
        return Object.entries(rule).flatMap(([key,value])=>paths(value,prefix?prefix+'.'+key:key));
    }
    const api={encode,decode,validate,paths:()=>paths(),schema,programDefaults,validateProgram,programSchema};
    if (typeof module!=='undefined' && module.exports) module.exports=api;
    root.RainSettingsCodec=api;
})(typeof window==='undefined'?globalThis:window);
