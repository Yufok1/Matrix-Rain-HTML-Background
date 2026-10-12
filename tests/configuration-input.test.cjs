const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const codec=require('./load-runtime.cjs')('rain-settings-codec.js');
const fixture=require('./settings-codec-ui.test.cjs'),code=codec.encode(fixture);
const other=codec.encode({...fixture,name:'Another configuration'});
function harness({wallpaper=false,clipboard,early}={}){
 const elements=new Map(),events=new Map(),timers=new Map();let previousCalls=0,imports=0,timerId=0;
 const element=id=>({id,value:'',textContent:'',disabled:false,hidden:false,listeners:{},
  addEventListener(type,fn){this.listeners[type]=fn;},setAttribute(key,value){this[key]=value;},removeAttribute(key){delete this[key];},focus(){},select(){},before(){}});
 elements.set('rain-camera-panel',element('rain-camera-panel'));
 const document={getElementById:id=>elements.get(id),createElement(){return {
  style:{},set innerHTML(text){for(const [,id] of text.matchAll(/id="([^"]+)"/g))elements.set(id,element(id));}
 };}};
 const context={document,navigator:{clipboard},RainSettingsCodec:codec,
  setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);},
  wallpaperPropertyListener:{otherMethod(){},applyUserProperties(){previousCalls++;}},
  addEventListener(type,fn){events.set(type,fn);}};
 if(wallpaper)context.wallpaperRegisterAudioListener=()=>{};
 context.window=context;vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../rain-settings-share.js'),'utf8'),context);
 if(early!==undefined)context.wallpaperPropertyListener.applyUserProperties({configurationcode:{value:early}});
 events.get('DOMContentLoaded')();
 context.rainSettingsShare.export=()=>other;
 context.rainSettingsShare.import=text=>{const settings=codec.decode(text);imports++;return settings;};
 return {context,el:id=>elements.get(id),imports:()=>imports,previousCalls:()=>previousCalls,
  expire(){for(const [id,timer] of timers){assert.equal(timer.delay,4000);timers.delete(id);timer.fn();}},timerCount:()=>timers.size};
}
(async()=>{
 let reads=0,writes=[];
 const h=harness({clipboard:{async readText(){reads++;return ' \n'+code+'\n ';},async writeText(text){writes.push(text);}}});
 assert.equal(reads,0,'Opening settings must not read the clipboard');
 await h.el('rain-share-paste').onclick();
 assert.equal(h.el('rain-share-blob').value,code);assert.equal(reads,1);assert.equal(h.imports(),0);
 assert.match(h.el('rain-share-status').textContent,/Click Import/);
 await h.el('rain-share-paste').onclick();assert.equal(h.el('rain-share-blob').value,code);assert.equal(reads,2,'The second click must read again');
 let prevented=0;
 h.el('rain-share-blob').listeners.paste({clipboardData:{getData:()=>other},preventDefault(){prevented++;}});
 assert.equal(prevented,1);assert.equal(h.el('rain-share-blob').value,other,'Manual paste must replace the complete code');
 h.el('rain-share-blob').listeners.paste({clipboardData:{getData:()=>code},preventDefault(){prevented++;}});
 assert.equal(h.el('rain-share-blob').value,code,'Repeated manual paste must not concatenate codes');
 h.el('rain-share-import').onclick();assert.equal(h.imports(),1);assert.equal(h.el('rain-share-name').value,fixture.name);
 await h.el('rain-share-copy').onclick();assert.deepEqual(writes,[code]);
 const denied=harness({wallpaper:true,clipboard:{readText:async()=>{throw Error('NotAllowedError');}}});
 denied.el('rain-share-blob').value=other;await denied.el('rain-share-paste').onclick();
 assert.equal(denied.el('rain-share-blob').value,other);assert.equal(denied.imports(),0);
 assert.match(denied.el('rain-share-status').textContent,/Installed tab/);assert.equal(denied.el('rain-share-paste').disabled,false);
 assert.equal(denied.el('rain-share-wallpaper-help').hidden,false);
 for(const text of ['garbage','',code.slice(0,40)]){
  const invalid=harness({clipboard:{readText:async()=>text}});invalid.el('rain-share-blob').value=other;
  await invalid.el('rain-share-paste').onclick();assert.equal(invalid.el('rain-share-blob').value,other);assert.equal(invalid.imports(),0);
  assert.match(invalid.el('rain-share-status').textContent,/Clipboard code:/);
 }
 const startup=harness({wallpaper:true,early:code});
 assert.equal(startup.el('rain-share-blob').value,code);assert.equal(startup.imports(),0);assert.equal(startup.previousCalls(),1);
 assert.equal(typeof startup.context.wallpaperPropertyListener.otherMethod,'function');
 startup.context.wallpaperPropertyListener.applyUserProperties({configurationcode:{value:'bad'}});
 assert.equal(startup.el('rain-share-blob').value,code);assert.equal(startup.imports(),0);
 startup.context.wallpaperPropertyListener.applyUserProperties({configurationcode:{value:other}});
 assert.equal(startup.el('rain-share-blob').value,other);startup.el('rain-share-import').onclick();assert.equal(startup.imports(),1);
 let resolve;const race=harness({clipboard:{readText:()=>new Promise(r=>resolve=r)}});
 const pending=race.el('rain-share-paste').onclick();assert.equal(race.el('rain-share-paste').disabled,false);
 race.el('rain-share-export').onclick();resolve(code);await pending;
 assert.equal(race.el('rain-share-blob').value,other,'Late clipboard result overwrote a newer export');
 assert.match(race.el('rain-share-status').textContent,/Exported/);assert.equal(race.imports(),0);
 const attempts=[];const retry=harness({clipboard:{readText:()=>new Promise(r=>attempts.push(r))}});
 retry.el('rain-share-blob').value=code;
 const first=retry.el('rain-share-paste').onclick(),second=retry.el('rain-share-paste').onclick();
 assert.equal(retry.el('rain-share-paste').disabled,false);assert.equal(retry.timerCount(),2);
 attempts[1](other);await second;await first;
 assert.equal(retry.el('rain-share-blob').value,other);assert.equal(retry.timerCount(),0);
 attempts[0](code);await Promise.resolve();await Promise.resolve();
 assert.equal(retry.el('rain-share-blob').value,other,'The old read cannot overwrite the retry');
 const stuck=harness({wallpaper:true,clipboard:{readText:()=>new Promise(()=>{})}});
 stuck.el('rain-share-blob').value=other;const hanging=stuck.el('rain-share-paste').onclick();
 assert.equal(stuck.el('rain-share-paste').disabled,false);stuck.expire();await hanging;
 assert.equal(stuck.el('rain-share-blob').value,other);assert.match(stuck.el('rain-share-status').textContent,/Installed tab/);
 assert.equal(stuck.timerCount(),0);assert.equal(stuck.el('rain-share-paste')['aria-busy'],undefined);
 const again=stuck.el('rain-share-paste').onclick();stuck.expire();await again;
 assert.equal(stuck.el('rain-share-paste').disabled,false);assert.equal(stuck.imports(),0);
 const unavailable=harness();await unavailable.el('rain-share-paste').onclick();
 assert.match(unavailable.el('rain-share-status').textContent,/Paste the code into the box/);
 console.log('PASS configuration input: whole-code replacement, never-settling read timeout, immediate retry, superseded reads ignored, explicit import, invalid/denied input preserved, native properties.');
})().catch(error=>{console.error(error);process.exitCode=1;});
