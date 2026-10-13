// Active audio: 55% Katakana, 45% accent alphabet. Silence: all Katakana.
(function(root){
    const kana='アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポ';
    const sets=['01','0123456789ABCDEF','ABCDEFGHIJKLMNOPQRSTUVWXYZ','@#$%&*+-=<>'];
    let quiet=true,pool=sets[0],serial=0;
    const api={
        update(spectrum,motion,now){
            let peak=0;for(const v of spectrum||[])peak=Math.max(peak,Number(v)||0);
            quiet=peak<.003;
            if(quiet)return;
            if(motion?.accent){
                pool=sets[Math.max(0,motion.region||0)%sets.length];
            }
        },
        choose(column,now){
            const id=++serial;
            // Keep the requested weighting throughout active audio.
            const fraction=quiet?0:.45;
            const hash=((Math.imul(id,1664525)^Math.imul((column||0)+1,1013904223))>>>0)/4294967296;
            const chars=hash<fraction?pool:kana;
            return chars[(Math.imul(id,1103515245)>>>0)%chars.length];
        }
    };
    root.rainAudioCharacters=api;
    if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
