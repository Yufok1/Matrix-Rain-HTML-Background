(function(root){
    'use strict';
    class WordTimeline {
        constructor(){this.clear();}
        clear(){this.words=[];this.revision=0;}
        add(chunks,offset,from=offset,to=Infinity){
            const words=[];
            for(const chunk of chunks||[]){
                const text=String(chunk.text||'').trim(),start=Number(chunk.timestamp?.[0])+offset;
                const end=chunk.timestamp?.[1]==null?start+.3:Number(chunk.timestamp[1])+offset;
                if(!text||/^[([].*[)\]]$/.test(text)||!Number.isFinite(start)||!Number.isFinite(end)||start<from||start>=to)continue;
                words.push({text,start,end:Math.max(start+.02,end)});
            }
            this.words=this.words.filter(w=>w.start<from||w.start>=to).concat(words).sort((a,b)=>a.start-b.start);this.revision++;
        }
        at(time,count=3){
            // Keep the latest lyrics through instrumental passages. Only a
            // new timestamped word, a seek or stopping words changes the pool.
            const now=this.words.filter(w=>w.start<=time).slice(-count);
            return now.map(w=>w.text).join(' ');
        }
    }
    root.RainWordTimeline=WordTimeline;
})(typeof window==='undefined'?globalThis:window);
