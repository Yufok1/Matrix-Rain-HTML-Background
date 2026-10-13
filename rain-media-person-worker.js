// Google's Selfie Segmenter: person/background only, entirely local.
let segmenter=null,loading=null,busy=false,frames=0;
async function load(){
    if(loading)return loading;
    loading=(async()=>{
        const {FilesetResolver,ImageSegmenter}=await import('./vendor/mediapipe/package/vision_bundle.mjs');
        const files=await FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/package/wasm/',self.location.href).href);
        segmenter=await ImageSegmenter.createFromOptions(files,{
            baseOptions:{modelAssetPath:new URL('./vendor/mediapipe/selfie_segmenter.tflite',self.location.href).href,delegate:'CPU'},
            runningMode:'VIDEO',outputConfidenceMasks:true,outputCategoryMask:false
        });
        postMessage({type:'ready',engine:'MediaPipe Selfie Segmenter · local worker'});
    })();return loading;
}
self.onmessage=async({data})=>{
    try{
        if(data.type==='init'){await load();return;}
        if(data.type==='dispose'){if(loading)await loading.catch(()=>{});segmenter?.close();postMessage({type:'disposed'});close();return;}
        if(data.type!=='frame'||busy)return;busy=true;await load();
        const start=performance.now(),image=new ImageData(new Uint8ClampedArray(data.rgba),data.width,data.height);
        segmenter.segmentForVideo(image,data.time,result=>{
            const masks=result.confidenceMasks,mask=masks[masks.length-1],values=mask.getAsFloat32Array();
            const pixels=new Uint8Array(values.length);for(let i=0;i<values.length;i++)pixels[i]=Math.round(values[i]*255);
            postMessage({type:'depth',epoch:data.epoch,width:mask.width,height:mask.height,frames:++frames,ms:performance.now()-start,depth:pixels.buffer},[pixels.buffer]);
        });
    }catch(error){postMessage({type:'error',message:error.message});}finally{busy=false;}
};
