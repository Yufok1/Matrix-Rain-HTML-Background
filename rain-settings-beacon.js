// A small projected mesh. It shares the rain's render clock and opens no GPU context.
const identity=[1,0,0,0,1,0,0,0,1];
const normalize=v=>{const length=Math.hypot(...v)||1;return v.map(x=>x/length);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const rotate=(r,v)=>[0,3,6].map(i=>r[i]*v[0]+r[i+1]*v[1]+r[i+2]*v[2]);
const directions={up:[0,-1,0],down:[0,1,0],left:[-1,0,0],right:[1,0,0],toward:[0,0,-1],away:[0,0,1]};

export function beaconPose(direction,reverse=1,view=identity){
    const forward=(directions[direction]||directions.down).map(x=>-x*(reverse===-1?-1:1));
    const reference=Math.abs(forward[2])>.9?[0,1,0]:[0,0,1];
    let right=normalize(cross(reference,forward)),normal=normalize(cross(forward,right));
    // Bank the physical logo rails so their thickness reads in the flat view.
    const bank=.34,c=Math.cos(bank),s=Math.sin(bank),oldRight=right;
    right=right.map((x,i)=>x*c+normal[i]*s);
    normal=normal.map((x,i)=>x*c-oldRight[i]*s);
    const a=rotate(view,right),b=rotate(view,forward.map(x=>-x)),n=rotate(view,normal);
    return {worldForward:forward,viewForward:rotate(view,forward),matrix:[a[0],b[0],n[0],a[1],b[1],n[1],a[2],b[2],n[2]]};
}

function quaternion(m){
    let x,y,z,w,s;const trace=m[0]+m[4]+m[8];
    if(trace>0){s=Math.sqrt(trace+1)*2;w=s/4;x=(m[7]-m[5])/s;y=(m[2]-m[6])/s;z=(m[3]-m[1])/s;}
    else if(m[0]>m[4]&&m[0]>m[8]){s=Math.sqrt(1+m[0]-m[4]-m[8])*2;w=(m[7]-m[5])/s;x=s/4;y=(m[1]+m[3])/s;z=(m[2]+m[6])/s;}
    else if(m[4]>m[8]){s=Math.sqrt(1+m[4]-m[0]-m[8])*2;w=(m[2]-m[6])/s;x=(m[1]+m[3])/s;y=s/4;z=(m[5]+m[7])/s;}
    else{s=Math.sqrt(1+m[8]-m[0]-m[4])*2;w=(m[3]-m[1])/s;x=(m[2]+m[6])/s;y=(m[5]+m[7])/s;z=s/4;}
    return normalize([x,y,z,w]);
}
function blend(a,b,t){
    if(dot(a,b)<0)b=b.map(x=>-x);
    return normalize(a.map((x,i)=>x+(b[i]-x)*t));
}
function matrix([x,y,z,w]){
    return [1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)];
}

const faces=[];
// Android res/drawable/icon.xml: black, #00FF66 rails, half-opacity white tail blocks.
const palette={hull:[8,18,12],pod:[26,61,39],logo:[0,255,102],tail:[127,127,127],exhaust:[0,255,102],core:[229,255,239]};
function prism(points,front,back,color,lit=false){
    const a=points.map(([x,y])=>[x,y,front]),b=points.map(([x,y])=>[x,y,back]);
    faces.push({points:a,color,lit,normal:[0,0,-1]},{points:b.slice().reverse(),color,normal:[0,0,1]});
    for(let i=0;i<points.length;i++){
        const j=(i+1)%points.length,dx=points[j][0]-points[i][0],dy=points[j][1]-points[i][1];
        faces.push({points:[a[i],b[i],b[j],a[j]],color,normal:normalize([dy,-dx,0])});
    }
}
function cylinder(radius,from,to,centerZ,color){
    const count=12,ring=Array.from({length:count},(_,i)=>{
        const angle=i*Math.PI*2/count;
        return [Math.cos(angle)*radius,centerZ+Math.sin(angle)*radius];
    });
    const a=ring.map(([x,z])=>[x,from,z]),b=ring.map(([x,z])=>[x,to,z]);
    faces.push({points:a,color,normal:[0,-1,0]},{points:b.slice().reverse(),color,normal:[0,1,0]});
    for(let i=0;i<count;i++){
        const j=(i+1)%count,angle=(i+.5)*Math.PI*2/count;
        faces.push({points:[a[i],a[j],b[j],b[i]],color,normal:[Math.cos(angle),0,Math.sin(angle)]});
    }
}
const rectangle=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
prism([[0,-24],[6,-16],[16,-7],[19,17],[7,12],[0,18],[-7,12],[-19,17],[-16,-7],[-6,-16]],-1,5,palette.hull);
// A wider center pod breaks the flat underside without changing the nose or wings.
cylinder(4.6,-15,14,3.8,palette.pod);
// The existing four-bar logo becomes four raised rails on the same angular hull.
for(const [x,y,h] of [[-14,-14,22],[-6,-9,26],[2,-17,23],[10,-1,19]])prism(rectangle(x,y,4,h),-4,-1,palette.logo,true);
for(const [x,y] of [[-14,11],[-6,20],[2,9]])prism(rectangle(x,y,4,3),-3,-1,palette.tail,true);
prism([[-3,-17],[0,-22],[3,-17],[0,-12]],-4,-1,palette.logo,true);
for(const x of [-11,7])prism(rectangle(x,16,4,3),-1,3,palette.logo,true);
// Short icon-green engine plumes, attached to the tail in object space.
for(const x of [-9,9]){
    const ring=[[x-1.5,19,1],[x,19,-.5],[x+1.5,19,1],[x,19,2.5]];
    for(let i=0;i<4;i++)faces.push({points:[ring[i],ring[(i+1)%4],[x,26,1]],color:palette.exhaust,normal:[0,0,-1],exhaust:true,lit:true});
    faces.push({points:[[x-.5,18.8,1],[x+.5,18.8,1],[x,22,1]],color:palette.core,normal:[0,0,-1],exhaust:true,core:true,lit:true});
}
const light=normalize([-.35,-.55,-1]);

export function createSettingsBeacon(button,readState){
    const canvas=document.createElement('canvas');canvas.className='settings-launch-icon settings-beacon';canvas.setAttribute('aria-hidden','true');
    const fallback=button.querySelector('.settings-launch-icon');fallback.replaceWith(canvas);
    const context=canvas.getContext('2d');
    if(!context){canvas.replaceWith(fallback);return {update(){}};}
    let pose=null,last=null,lastPaint=-Infinity,size=0,previous=null;
    const reduced=matchMedia('(prefers-reduced-motion:reduce)');
    reduced.addEventListener('change',()=>{previous=null;});
    const beacon={update(now=performance.now()){
        if(document.hidden||!button.closest('.matrix-modal')?.classList.contains('minimized')){last=null;return;}
        const state=readState(),view=state.view||identity,target=beaconPose(state.direction,state.reverse,view);
        const desired=quaternion(target.matrix),dt=last===null?1000/30:Math.max(0,Math.min(100,now-last));last=now;
        pose=pose===null||reduced.matches?desired:blend(pose,desired,1-Math.exp(-dt/110));
        const difference=previous?1-Math.abs(dot(previous,pose)):1;
        const ratio=Math.min(2,Math.max(1,window.devicePixelRatio||1)),pixels=Math.round(48*ratio);
        if(reduced.matches&&previous&&difference<1e-7&&size===pixels)return;
        if(now-lastPaint<1000/30)return;
        lastPaint=now;previous=pose.slice();
        if(size!==pixels){size=pixels;canvas.width=canvas.height=pixels;}
        context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,48,48);
        const t=now/1000,idle=reduced.matches?0:1;
        // A slow local bank and hover, independent of rain color or choreography.
        const bank=idle*Math.sin(t*1.3)*.035,cb=Math.cos(bank),sb=Math.sin(bank);
        const orientation=matrix(pose),forward=rotate(orientation,[0,-1,0]);
        const hover=idle*Math.sin(t*1.55)*1.15;
        const shift=[forward[0]*hover,forward[1]*hover+idle*Math.sin(t*.9)*.35];
        const thrust=reduced.matches?1:.86+.14*Math.sin(t*2.1);
        const projected=faces.map(face=>{
            const points=face.points.map(([x,y,z])=>{
                if(face.exhaust)y=19+(y-19)*thrust;
                return rotate(orientation,[x*cb+z*sb,y,z*cb-x*sb]);
            });
            const [nx,ny,nz]=face.normal;
            return {...face,points,depth:points.reduce((sum,p)=>sum+p[2],0)/points.length,normal:rotate(orientation,[nx*cb+nz*sb,ny,nz*cb-nx*sb])};
        }).sort((a,b)=>b.depth-a.depth);
        for(const face of projected){
            if(!face.exhaust&&face.normal[2]>.05)continue;
            const illumination=(face.lit?.66:.48)+Math.max(0,dot(face.normal,light))*(face.lit?.34:.52);
            context.beginPath();
            face.points.forEach(([x,y,z],i)=>{
                const scale=110/(110+z)*.83,px=24+x*scale+shift[0],py=24+y*scale+shift[1];
                if(i)context.lineTo(px,py);else context.moveTo(px,py);
            });
            context.closePath();context.globalAlpha=face.exhaust?(face.core?.75:.14):1;
            context.fillStyle=`rgb(${face.color.map(x=>Math.round(x*illumination)).join(',')})`;context.fill();
            if(face.exhaust)continue;
            context.lineWidth=.55;context.strokeStyle=face.lit?'#00ff6666':'#367b4e99';context.stroke();
        }
        context.globalAlpha=1;
        beacon.snapshot={...target,direction:state.direction,reverse:state.reverse,faces:projected.length,pixelSize:size,idle:!!idle,thrust};
    }};
    return beacon;
}
