// One responsive palette for the field, driven by midrange shape and dynamics.
// This does not separate vocals, recognize words, or estimate musical notes.
(function(root){
    'use strict';
    const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
    const wrap=h=>(h%360+360)%360;
    const palettes={
        zen:[158,96],prism:[240,144],neon:[135,95],aurora:[195,108],
        crystal:[205,84],pastel:[285,96],hyperneon:[280,144],vaporwave:[292,78],
        bassstorm:[35,86],inferno:[20,56],default:[160,110]
    };
    function rgb(h,s,l){
        s/=100;l/=100;const a=s*Math.min(l,1-l);
        return [0,8,4].map(n=>{const k=(n+h/30)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1));});
    }
    class RainAudioColor {
        constructor(){this.reset();}
        static inkLightness(value){return clamp((Number(value)||0)*.6,0,48);}
        reset(){
            this.bins=new Float32Array(64);this.sampledAt=null;
            this.key=null;this.hue=null;this.baseHue=null;this.unwrappedHue=null;this.center=null;this.contourSlow=null;this.levelSlow=null;
            this.saturation=85;this.lightness=30;this.ready=false;this.voicedMs=0;
            this.snapshot=null;
        }
        update(spectrum,now,{source='browser',preset='zen',sensitivity=100,hueScale=1,
            satFloor=65,satGain=1,brightnessMin=36,brightnessMax=64,brightnessDepth=1}={}){
            const first=this.sampledAt===null, gap=!first && now-this.sampledAt>250;
            const dt=first||gap ? 1000/30 : clamp(now-this.sampledAt,1,100);
            this.sampledAt=now;
            const follow=(a,b,ms)=>a+(b-a)*(1-Math.exp(-dt/ms));
            const [baseHue,halfSpan]=palettes[preset]||palettes.default;
            const key=source+':'+preset;
            if(this.key!==key){
                this.key=key;this.voicedMs=0;this.bins.fill(0);this.contourSlow=null;this.levelSlow=null;
                this.center=baseHue+360*Math.round(((this.unwrappedHue??baseHue)-baseHue)/360);
            }
            if(gap){this.bins.fill(0);this.voicedMs=0;this.contourSlow=null;this.levelSlow=null;}
            // Browser bins are logarithmic 20–16000 Hz, so 21–49 cover
            // approximately 180–3500 Hz. WE does not document exact Hz per
            // band; its window follows the application's low-mid/mid region.
            const start=source==='wallpaper' ? 8 : 21;
            const end=source==='wallpaper' ? 40 : 50;
            let peak=0,weight=0,position=0,shapeWeight=0;
            for(let i=start;i<end;i++){
                const value=clamp(Number(spectrum[i])||0,0,1);
                peak=Math.max(peak,value);
                this.bins[i]=follow(this.bins[i],value,value>this.bins[i]?50:100);
                const x=(i-start)/(end-start-1);
                const window=.2+.8*Math.sin(Math.PI*x);
                const w=Math.pow(this.bins[i],1.6)*window;
                weight+=w;position+=w*x;
                // A symmetric redistribution can have exactly the same
                // centroid. This second moment distinguishes a concentrated
                // middle from split/shouldered spectral detail at equal gain.
                shapeWeight+=w*Math.cos(2*Math.PI*x);
            }
            const melodic=peak>=.003 && weight>1e-7;
            this.voicedMs=melodic ? this.voicedMs+dt : 0;
            const contour=weight>1e-7 ? position/weight : null;
            const spectralShape=weight>1e-7 ? shapeWeight/weight : 0;
            this.baseHue=baseHue;
            if(this.hue===null){this.hue=baseHue;this.unwrappedHue=this.center;}
            if(this.voicedMs>=100)this.ready=true;
            let target=this.unwrappedHue;
            if(melodic && this.voicedMs>=100){
                // The user-approved v4 500% response is the new 100% baseline.
                const sensitivityScale=clamp(Number(sensitivity)||100,100,500)/100;
                const gain=5*sensitivityScale;
                const scale=clamp(Number(hueScale)||1,.5,2);
                // Absolute tonal destination plus recent spectral movement.
                // Sensitivity expands recent changes without saturating the
                // base map or rerolling a different hue for each character.
                const feature=contour-.5+.28*spectralShape;
                const baseline=Math.tanh(feature*scale*3.2);
                if(this.contourSlow===null)this.contourSlow=feature;
                const fluctuation=Math.tanh((feature-this.contourSlow)*32*sensitivityScale);
                // Keep the excursion inside this preset's palette. Higher
                // sensitivity detects fainter detail, not out-of-range hues.
                const expression=baseline+.92*(1-Math.abs(baseline))*fluctuation;
                this.contourSlow=follow(this.contourSlow,feature,600);
                target=this.center+halfSpan*expression;
                // At higher sensitivity the larger excursion must also be
                // allowed to arrive in time. This cap governs the entire field.
                const responseMs=120/Math.sqrt(gain),degreesPerMs=(96+48*(sensitivityScale-1))/1000;
                const change=(target-this.unwrappedHue)*(1-Math.exp(-dt/responseMs));
                this.unwrappedHue+=clamp(change,-dt*degreesPerMs,dt*degreesPerMs);
                this.hue=wrap(this.unwrappedHue);
                // Preserve real phrase/syllable dynamics within the configured
                // bounds instead of compressing them to a nearly fixed shade.
                if(this.levelSlow===null)this.levelSlow=peak;
                const levelChange=Math.tanh((peak-this.levelSlow)/(this.levelSlow+.025)*1.6*Math.sqrt(gain));
                this.levelSlow=follow(this.levelSlow,peak,600);
                const satTarget=clamp(78+12*Math.sqrt(peak)*satGain+12*levelChange*satGain,satFloor,100);
                const lightTarget=RainAudioColor.inkLightness(brightnessMin+(brightnessMax-brightnessMin)*clamp(.32+.45*Math.sqrt(peak)*brightnessDepth+.32*levelChange*brightnessDepth,.08,.92));
                this.saturation=follow(this.saturation,satTarget,130/Math.sqrt(gain));
                this.lightness=follow(this.lightness,lightTarget,130/Math.sqrt(gain));
            } else if(!melodic) {
                this.lightness=follow(this.lightness,RainAudioColor.inkLightness(brightnessMin),200);
            }
            // Two nearby endpoints give each stream a stable, slight tint.
            // Every historical glyph in that stream uses the same endpoint mix.
            const colorA=rgb(wrap(this.hue-4),this.saturation,Math.min(48,this.lightness+1.5));
            const colorB=rgb(wrap(this.hue+4),Math.max(satFloor,this.saturation-3),Math.max(0,this.lightness-1.5));
            this.snapshot={hue:this.hue,saturation:this.saturation,lightness:this.lightness,
                colorA,colorB,ready:this.ready,melodic,contour,spectralShape,target:wrap(target),halfSpan,baseHue:this.baseHue};
            return this.snapshot;
        }
    }
    root.RainAudioColor=RainAudioColor;
    if(typeof module==='object' && module.exports)module.exports=RainAudioColor;
})(typeof window==='object'?window:globalThis);
