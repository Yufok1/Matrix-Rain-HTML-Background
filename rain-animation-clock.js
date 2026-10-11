// Simulation keeps character-sized steps; presentation follows display refresh.
class RainAnimationClock {
    constructor({step, render, getDelay, request = fn => requestAnimationFrame(fn), cancel = id => cancelAnimationFrame(id)}) {
        this.step=step; this.render=render; this.getDelay=getDelay;
        this.request=request; this.cancel=cancel; this.handle=null; this.last=null; this.elapsed=0;
        this.tick=this.tick.bind(this);
    }
    get running(){return this.handle!==null;}
    start(){this.stop();this.last=null;this.elapsed=0;this.handle=this.request(this.tick);}
    stop(){if(this.running)this.cancel(this.handle);this.handle=null;}
    tick(now){
        if(!this.running)return;
        const delay=Math.max(4,Number(this.getDelay())||35);
        const gap=this.last===null?0:Math.max(0,now-this.last);
        this.elapsed=this.last===null||gap>250?delay:this.elapsed+gap;
        this.last=now;
        let count=0;
        while(this.elapsed>=delay&&count<4&&this.running){this.step();this.elapsed-=delay;count++;}
        if(this.elapsed>=delay)this.elapsed%=delay;
        if(this.running){this.render(now,this.elapsed/delay);this.handle=this.request(this.tick);}
    }
}
