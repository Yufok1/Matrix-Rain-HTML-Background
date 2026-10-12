(function(root){
    'use strict';
    root.rainColorMode='cohesive';
    root.rainAudioPalette={active:false,colorA:[0,1,.25],colorB:[0,1,.25]};
    root.rainMelodyColor=new root.RainAudioColor();
    root.addEventListener('DOMContentLoaded',()=>{setColorPreset('zen');});
})(window);
