// Recognition runs in this worker. Only model assets are downloaded; audio stays here.
import {env,pipeline} from './vendor/speech/transformers.min.js';
env.allowRemoteModels=true;env.allowLocalModels=true;
env.localModelPath=new URL('./vendor/speech/models/',import.meta.url).href;
env.backends.onnx.wasm.wasmPaths=new URL('./vendor/speech/',import.meta.url).href;
env.backends.onnx.wasm.numThreads=1;env.backends.onnx.wasm.proxy=false;
const profiles={
    accurate:{model:'Xenova/whisper-base.en',revision:'95bf40a508535962c6483ead40270b2e32267508'},
    fast:{model:'Xenova/whisper-tiny.en',revision:'79fb389fc764e7c395bd330e9531d9d32ada7049'}
};
let model,loading=null,inference=null,disposing=false;
self.onmessage=async({data})=>{
    try{
        if(data.action==='load'){
            if(disposing||loading||model)return;
            const device=data.device||'webgpu';
            const profile=profiles[data.quality]||profiles.accurate;
            loading=pipeline('automatic-speech-recognition',profile.model,{
                revision:profile.revision,device,dtype:device==='webgpu'?{encoder_model:'fp32',decoder_model_merged:'q4'}:'q8',
                progress_callback:info=>{if(!disposing&&['progress','done'].includes(info.status))self.postMessage({event:'progress',file:info.file,progress:info.status==='done'?100:info.progress??0});}
            });
            model=await loading;loading=null;if(disposing)return;
            // The 3.8.1 pipeline passes 100 Hz mel-frame counts to its DTW
            // extractor. Whisper's encoder halves that rate. Crop attention
            // to encoder frames, as the reference Whisper implementation does,
            // so padding beyond the clip cannot attract every word timestamp.
            const extract=model.model._extract_token_timestamps.bind(model.model);
            model.model._extract_token_timestamps=(outputs,heads,frames,precision)=>extract(outputs,heads,frames==null?null:Math.floor(frames/2),precision);
            self.postMessage({event:'ready',device});
        }else if(data.action==='recognize'){
            if(disposing)return;
            if(!model||inference)throw Error('Recognizer is not ready for another audio segment.');
            const start=performance.now();
            inference=model(data.pcm,{do_sample:false,num_beams:1,return_timestamps:'word',max_new_tokens:128});
            const result=await inference;inference=null;if(disposing)return;
            const duration=data.pcm.length/16000;
            if((result.chunks||[]).some(c=>c.timestamp?.[0]>duration+.1||c.timestamp?.[1]>duration+.1))throw Error('Recognizer returned timestamps outside the supplied audio.');
            self.postMessage({event:'result',id:data.id,text:result.text,chunks:result.chunks,seconds:(performance.now()-start)/1000});
        }else if(data.action==='dispose'){
            if(disposing)return;disposing=true;
            try{
                if(loading)model=await loading.catch(()=>null);
                if(inference)await inference.catch(()=>{});
                await model?.dispose();model=null;
            }finally{self.postMessage({event:'disposed'});self.close();}
        }
    }catch(error){if(!disposing)self.postMessage({event:'error',id:data.id,message:error.message});}
};
