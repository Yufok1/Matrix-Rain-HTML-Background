const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('rain-timed-words-worker.js','utf8').replace(/^import .*;\r?\n/m,'').replaceAll('import.meta.url',"'https://example.test/rain-timed-words-worker.js'");
function fixture(){
 let finishLoad,finishInference,loads=0,disposals=0,closed=false,options;const events=[];
 const model=()=>new Promise(resolve=>finishInference=resolve);model.model={_extract_token_timestamps(){}};model.dispose=async()=>{disposals++;};
 const self={postMessage(event){events.push(event);},close(){closed=true;}};
 const context=vm.createContext({self,env:{backends:{onnx:{wasm:{}}}},URL,performance,pipeline(_task,_model,value){loads++;options=value;return new Promise(resolve=>finishLoad=resolve);}});vm.runInContext(source,context);
 return {events,send(data){return self.onmessage({data});},finishLoad(){finishLoad(model);},finishInference(){finishInference({text:'hello',chunks:[{text:'hello',timestamp:[0,.1]}]});},progress(info){options.progress_callback(info);},get loads(){return loads;},get disposals(){return disposals;},get closed(){return closed;}};
}
(async()=>{
 const loading=fixture(),first=loading.send({action:'load'});await loading.send({action:'load'});assert.equal(loading.loads,1,'Repeated load messages share one initialization');loading.progress({status:'progress',file:'encoder_model.onnx',progress:0});assert.equal(loading.events.at(-1).progress,0);const cancel=loading.send({action:'dispose'});loading.finishLoad();await Promise.all([first,cancel]);assert.equal(loading.disposals,1,'A model that finishes loading during cancellation is disposed');assert.equal(loading.closed,true);assert.ok(!loading.events.some(e=>e.event==='ready'),'Canceled loading never announces a usable recognizer');assert.equal(loading.events.at(-1).event,'disposed');
 const inference=fixture(),load=inference.send({action:'load'});inference.finishLoad();await load;const recognizing=inference.send({action:'recognize',id:'old',pcm:new Float32Array(16000)}),shutdown=inference.send({action:'dispose'});assert.equal(inference.disposals,0,'Disposal waits for a running inference');inference.finishInference();await Promise.all([recognizing,shutdown]);assert.equal(inference.disposals,1);assert.equal(inference.closed,true);assert.ok(!inference.events.some(e=>e.event==='result'),'Canceled inference cannot publish stale lyrics');
 console.log('PASS single model initialization, zero progress, disposal during loading/inference and no stale ready/results.');
})().catch(error=>{console.error(error);process.exitCode=1;});
