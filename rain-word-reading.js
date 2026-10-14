(function(root){
    'use strict';
    root.RainWordReading={
        order(dx,dy,vertical='down',previous=1){
            if(Math.abs(dx)+Math.abs(dy)<1e-5)return previous;
            if(Math.abs(dx)>=Math.abs(dy))return dx<0?-1:1;
            return (dy<0?-1:1)*(vertical==='up'?-1:1);
        },
        letter(letters,index,order){return letters[order<0?letters.length-1-index: index];}
    };
})(typeof window==='undefined'?globalThis:window);
