// A small projected mesh. It shares the rain's render clock and opens no GPU context.
const identity=[1,0,0,0,1,0,0,0,1];
const normalize=v=>{const length=Math.hypot(...v)||1;return v.map(x=>x/length);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const rotate=(r,v)=>[0,3,6].map(i=>r[i]*v[0]+r[i+1]*v[1]+r[i+2]*v[2]);
const directions={up:[0,-1,0],down:[0,1,0],left:[-1,0,0],right:[1,0,0],toward:[0,0,-1],away:[0,0,1]};

export function beaconPose(direction,reverse=1,view=identity){
    const forward=(directions[direction]||directions.down).map(x=>-x*(reverse===-1?-1:1));
    const reference=Math.abs(forward[2])>.9?[0,1,0]:[0,0,1];
    let right=normalize(cross(reference,forward)),normal=normalize(cross(forward,right));
    // A slight bank reveals the arrowhead's sides in the flat view.
    const bank=.24,c=Math.cos(bank),s=Math.sin(bank),oldRight=right;
    right=right.map((x,i)=>x*c+normal[i]*s);
    normal=normal.map((x,i)=>x*c-oldRight[i]*s);
    const a=rotate(view,right),b=rotate(view,forward.map(x=>-x)),n=rotate(view,normal);
    return {worldForward:forward,viewForward:rotate(view,forward),matrix:[a[0],b[0],n[0],a[1],b[1],n[1],a[2],b[2],n[2]]};
}

function complementHue(color='#00ff41'){
    const hsl=/^hsl\(\s*(-?[\d.]+)/i.exec(color);
    if(hsl)return ((Number(hsl[1])+180)%360+360)%360;
    let hex=/^#([\da-f]{3}|[\da-f]{6})$/i.exec(color)?.[1];
    if(!hex)return 300;
    if(hex.length===3)hex=hex.split('').map(x=>x+x).join('');
    const rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255);
    const max=Math.max(...rgb),min=Math.min(...rgb),delta=max-min;
    if(delta<.001)return 300; // A saturated accent remains readable against neutral rain.
    const [r,g,b]=rgb;
    const hue=60*(max===r?(g-b)/delta:max===g?(b-r)/delta+2:(r-g)/delta+4);
    return ((hue+180)%360+360)%360;
}

const faces=[];
// The solid pyramid keeps its readable pointer silhouette.
const tip=[0,-23,0],base=[[-10,-2,-10],[10,-2,-10],[10,-2,10],[-10,-2,10]];
for(let i=0;i<4;i++){
    const a=base[i],b=base[(i+1)%4];
    const normal=normalize(cross(a.map((x,j)=>x-tip[j]),b.map((x,j)=>x-tip[j])));
    faces.push({points:[tip,a,b],material:'head',normal});
}
faces.push({points:base.slice().reverse(),material:'base',normal:[0,1,0]});
// Two nested, tapered jets: a narrow hot core inside a restrained orange glow.
// Small contractions suggest exhaust diamonds rather than a cartoon flame.
for(const layer of [
    {radii:[2.7,2.35,1.95,1.2,0],colors:['#ffc76d','#ffad42','#ff922b','#ff7420'],alpha:[.32,.29,.22,.09]},
    {radii:[1.45,1.2,1.3,.55,0],colors:['#fff9e9','#ffe9b1','#ffd270','#ffab39'],alpha:[1,.95,.8,.45]}
]){
    const ys=[-1,4,9,15,20],segments=6;
    for(let band=0;band<ys.length-1;band++)for(let side=0;side<segments;side++){
        const ring=(level,index)=>{const a=index*2*Math.PI/segments;return [Math.cos(a)*layer.radii[level],ys[level],Math.sin(a)*layer.radii[level]];};
        const points=[ring(band,side),ring(band,side+1),ring(band+1,side+1),ring(band+1,side)];
        const a=points[1].map((v,i)=>v-points[0][i]),b=points[3].map((v,i)=>v-points[0][i]);
        faces.push({points,material:'exhaust',normal:normalize(cross(b,a)),color:layer.colors[band],alpha:layer.alpha[band]});
    }
}
const light=normalize([-.35,-.55,-1]);

export function createSettingsBeacon(button,readState){
    const canvas=document.createElement('canvas');canvas.className='settings-launch-icon settings-beacon';canvas.setAttribute('aria-hidden','true');
    const fallback=button.querySelector('.settings-launch-icon');fallback.replaceWith(canvas);
    const context=canvas.getContext('2d');
    if(!context){canvas.replaceWith(fallback);return {update(){fallback.style.color=`hsl(${complementHue(readState().color)},100%,55%)`;}};}
    let lastPaint=-Infinity,size=0,previous=null,previousColor=null,previousDirection=null,previousReverse=null,previousRay=null;
    let viewport=null,position=null;
    const reduced=matchMedia('(prefers-reduced-motion:reduce)');
    reduced.addEventListener('change',()=>{previous=null;});
    const beacon={update(now=performance.now()){
        if(document.hidden||!button.closest('.matrix-modal')?.classList.contains('minimized')){position=null;return;}
        const state=readState(),view=state.view||identity,target=beaconPose(state.direction,state.reverse,view);
        const hue=complementHue(state.color);
        if(!position||viewport?.[0]!==innerWidth||viewport?.[1]!==innerHeight){
            const bounds=button.getBoundingClientRect();position=[bounds.x+bounds.width/2,bounds.y+bounds.height/2];viewport=[innerWidth,innerHeight];
        }
        // Off-axis projection uses the rain's focal length and viewport center.
        // A depth heading at the corner now aims along the same vanishing line.
        const ray=state.focal>0?[(position[0]-innerWidth/2)/state.focal,(position[1]-innerHeight/2)/state.focal]:[0,0];
        const cameraRay=normalize([...ray,1]);
        // Rain turns are right-angle changes: use their new pose without interpolating.
        const orientation=target.matrix;
        const headingChanged=state.direction!==previousDirection||state.reverse!==previousReverse;
        const difference=previous?Math.max(...orientation.map((v,i)=>Math.abs(v-previous[i])),...ray.map((v,i)=>Math.abs(v-previousRay[i]))):1;
        const ratio=Math.min(2,Math.max(1,window.devicePixelRatio||1)),pixels=Math.round(48*ratio);
        if(reduced.matches&&previous&&difference<1e-7&&size===pixels&&hue===previousColor)return;
        if(!headingChanged&&now-lastPaint<1000/30)return;
        lastPaint=now;previous=orientation.slice();previousColor=hue;previousDirection=state.direction;previousReverse=state.reverse;previousRay=ray.slice();
        if(size!==pixels){size=pixels;canvas.width=canvas.height=pixels;}
        context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,48,48);
        const t=now/1000,idle=reduced.matches?0:1;
        const audio=state.audio&&now-state.audio.at<=250?state.audio:null;
        const activity=idle*clamp(audio?.activity),impulse=idle*clamp(audio?.impulse);
        const speed=audio?activity*clamp((72-state.speed)/57):0;
        const thrust=clamp(activity*.28+speed*.22+impulse*.5);
        const jetStretch=1+thrust*.3+idle*Math.sin(t*29)*.012;
        // A slow local bank and hover, independent of the rain's choreography.
        const bank=idle*Math.sin(t*1.3)*.025,cb=Math.cos(bank),sb=Math.sin(bank);
        const forward=rotate(orientation,[0,-1,0]);
        const hover=idle*Math.sin(t*1.55)*.7;
        const shift=[forward[0]*hover,forward[1]*hover+idle*Math.sin(t*.9)*.2];
        const projected=faces.map(face=>{
            const points=face.points.map(([x,y,z])=>rotate(orientation,[x*cb+z*sb,face.material==='exhaust'?(y+1)*jetStretch-1:y,z*cb-x*sb]));
            const [nx,ny,nz]=face.normal;
            return {...face,points,depth:points.reduce((sum,p)=>sum+p[2],0)/points.length,normal:rotate(orientation,[nx*cb+nz*sb,ny,nz*cb-nx*sb])};
        }).sort((a,b)=>b.depth-a.depth);
        const project=([x,y,z])=>{const s=110/(110+z);return [(x-ray[0]*z)*s,(y-ray[1]*z)*s];};
        const extent=Math.max(...projected.flatMap(face=>face.points.flatMap(p=>project(p).map(Math.abs))));
        const fit=Math.min(.83,20.5/Math.max(1,extent));
        const pixel=p=>project(p).map((v,i)=>24+v*fit+shift[i]);
        const tones={head:[19,30,42,53],base:[13,21,29,37]},bands=[];
        context.lineJoin='miter';context.miterLimit=3;
        for(const face of projected){
            if(dot(face.normal,cameraRay)>.05)continue;
            // Four flat lighting bands, with no gradients or translucent faces.
            const exposure=Math.max(0,dot(face.normal,light));
            const band=exposure>.8?3:exposure>.5?2:exposure>.2?1:0;
            if(face.material!=='exhaust')bands.push(band);
            context.beginPath();
            face.points.forEach((p,i)=>{
                const [px,py]=pixel(p);
                if(i)context.lineTo(px,py);else context.moveTo(px,py);
            });
            context.closePath();
            if(face.material==='exhaust'){
                context.globalAlpha=face.alpha*(.85+thrust*.15);context.fillStyle=face.color;context.fill();context.globalAlpha=1;continue;
            }
            context.fillStyle=`hsl(${hue},100%,${tones[face.material][band]}%)`;context.fill();
            // Dark edging separates the faces; a fine bright rim reads over black rain.
            context.lineWidth=2.5;context.strokeStyle='#06080b';context.stroke();
            context.shadowColor=`hsl(${hue},100%,60%)`;context.shadowBlur=thrust*1.5;
            context.lineWidth=.7;context.strokeStyle=`hsl(${hue},65%,65%)`;context.stroke();context.shadowBlur=0;
        }
        context.globalAlpha=1;
        const viewForward=target.viewForward;
        const screenForward=[viewForward[0]-ray[0]*viewForward[2],viewForward[1]-ray[1]*viewForward[2]];
        const vanishingPoint=Math.abs(viewForward[2])>1e-8&&state.focal>0?[innerWidth/2+state.focal*viewForward[0]/viewForward[2],innerHeight/2+state.focal*viewForward[1]/viewForward[2]]:null;
        beacon.snapshot={...target,direction:state.direction,reverse:state.reverse,faces:projected.length,pixelSize:size,idle:!!idle,kind:'pointer',hue,bands,shading:'cel',position:position.slice(),ray,screenForward,vanishingPoint,thrust,exhaust:true};
    }};
    return beacon;
}
