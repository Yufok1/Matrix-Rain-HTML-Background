// Auto program editor. Native form controls say what is included; summaries
// describe the resulting program without requiring a button-color legend.
(function(){
 'use strict';
 const labels={camera:{flat:'Flat / 2D',fixed:'Still 3D',showcase:'Showcase',corkscrew:'Corkscrew',gyroscope:'Gyroscope'},flow:{directed:'Single direction',counterflow:'Counterflow',crossflow:'All directions'},characters:{katakana:'Katakana',matrix:'Mixed Matrix',binary:'Binary',hex:'Hex',symbols:'Symbols',custom:'Custom characters'},direction:{down:'Down',right:'Right',up:'Up',left:'Left',toward:'Toward',away:'Away'}};
 let host,status,summary,error,resume,stamp=0;const controls=[],summaries=[];
 const policy=()=>window.rainAutoPreferences, read=path=>path.split('.').reduce((v,k)=>v[k],policy().program);
 const node=(tag,text,className)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n;};
 const secs=r=>r.min===r.max?r.min+'s':r.min+'–'+r.max+'s';
 const poolSummary=key=>!read(key+'.change')?'Keep current':policy().values(key).map(k=>labels[key][k]).join(' · ');
 function commit(path,value){try{policy().edit(path,value);error.textContent='';}catch(e){error.textContent=e.message;}window.rainAutoUI.refresh();}
 function input(type,path,value,label){
  const wrap=node('label'),i=node('input');i.type=type;i.dataset.autoPath=path;
  i.id='auto-'+path.replaceAll('.','-')+(type==='radio'?'-'+value:'');
  if(type==='radio'){i.name='auto-'+path;i.value=String(value);}
  wrap.append(i,node('span',label));controls.push({i,path,value});
  i.addEventListener('change',()=>commit(path,type==='checkbox'?i.checked:type==='radio'?value:Number(i.value)));
  return wrap;
 }
 function numbers(parent,path,min,max,step=1,unit=''){
  const r=node('div',null,'auto-range');
  for(const [key,label]of [['min','Minimum'],['max','Maximum']]){
   const wrap=input('number',path+'.'+key,null,label+(unit?' ('+unit+')':'')),i=wrap.querySelector('input');
   i.min=min;i.max=max;i.step=step;wrap.append(i);r.append(wrap);
  }
  parent.append(r);return r;
 }
 function choice(parent,path,first='Keep current',second='Choose from these'){
  const row=node('div',null,'auto-choice');
  row.append(input('radio',path,false,first),input('radio',path,true,second));parent.append(row);
 }
 function pool(parent,key,title){
  const d=node('details',null,'settings-subcategory'),s=node('summary'),body=node('div');d.append(s,body);parent.append(d);
  summaries.push(()=>s.textContent=title+': '+poolSummary(key));choice(body,key+'.change');
  const box=node('fieldset',null,'auto-pool');box.dataset.autoEnabled=key+'.change';
  for(const [value,label]of Object.entries(labels[key]))box.append(input('checkbox',key+'.allowed.'+value,null,label));body.append(box);
   if(key==='camera')body.append(node('p','Choose one to keep that camera running throughout rain and cloud. Choose several to let Auto move between them. Flat transitions happen in rain.','settings-hint'));
  if(key==='characters')body.append(node('p','Custom uses the characters you entered under Rain. Audio response controls characters while it is listening.','settings-hint'));
   if(key==='direction')body.append(node('p','Toward and Away need a 3D camera; Auto waits until 3D is available.','settings-hint'));
  return d;
 }
 function range(parent,key,title,min,max,unit=''){
  const d=node('details',null,'settings-subcategory'),s=node('summary'),body=node('div');d.append(s,body);parent.append(d);
  summaries.push(()=>{const r=read(key);s.textContent=title+': '+(r.change?r.min+'–'+r.max+unit:'Keep current');});
  choice(body,key+'.change','Keep current','Use this range');const f=node('fieldset');f.dataset.autoEnabled=key+'.change';numbers(f,key,min,max,1,unit);body.append(f);
 }
 const ui=window.rainAutoUI={
  mount(parent,button,timing){
   host=parent;parent.classList.add('auto-program');
   summary=node('p',null,'auto-program-summary');summary.id='auto-program-summary';status=node('p',null,'settings-hint');status.id='auto-program-status';
   error=node('p',null,'auto-program-error');error.setAttribute('role','alert');
   resume=node('button','Resume appearance cycle');resume.type='button';resume.onclick=()=>{policy().held=false;policy().phase=null;ui.refresh();};
   parent.append(button,summary,status,resume,error);
   const appearances=node('fieldset',null,'auto-appearances');appearances.append(node('legend','Appearances and stay times'));
   for(const [key,label,min]of [['rain','Rain',.1],['cloud','Cloud',.1]]){
    const card=node('div',null,'auto-appearance');card.append(input('checkbox','appearances.'+key+'.enabled',null,label));
    const f=node('fieldset');f.dataset.autoEnabled='appearances.'+key+'.enabled';numbers(f,'appearances.'+key,min,60,.1,'s');card.append(f);appearances.append(card);
   }
   parent.append(appearances,node('p','One appearance stays on. Both alternate. Minimum = maximum gives a fixed stay; different values vary it. Stays begin after arrival; transitions keep their natural timing.','settings-hint'));
   pool(parent,'camera','Camera').open=true;
   const variations=node('details',null,'settings-subcategory');variations.append(node('summary','Other settings Auto may change'),node('div'));const v=variations.lastElementChild;
   v.append(timing);
   const order=node('fieldset');order.append(node('legend','Choice order'),input('radio','order','random','Random choices'),input('radio','order','sequence','Listed order'));v.append(order);
   v.append(node('p','Listed order cycles through your selected choices in the order shown. A single choice stays selected. Intermediate steps keep transitions continuous.','settings-hint'));
   pool(v,'flow','Flow patterns');pool(v,'characters','Characters');pool(v,'direction','Directions');
   range(v,'size','Character size',14,25,'px');range(v,'density','Density',1,100,'%');range(v,'speed','Speed',21,71,'%');
   for(const [key,title]of [['colors','Colors and rain style'],['trails','Trail settings'],['clarity','Rendering clarity']]){
    const f=node('fieldset');f.append(node('legend',title));choice(f,key,'Keep current','Let Auto vary');v.append(f);
   }
   v.append(node('p','Performance limits can reduce density below your range. Audio keeps control of its speed, direction, palette and characters.','settings-hint'));parent.append(variations);
   parent.append(node('p','Save this Auto setup with your usual Configuration code. Starting and stopping Auto remains manual.','settings-hint'));
   ui.refresh();
  },
  refresh(){
   if(!host)return;
   for(const {i,path,value}of controls){const current=read(path);if(i.type==='checkbox')i.checked=current;else if(i.type==='radio')i.checked=current===value;else if(document.activeElement!==i)i.value=current;
    if(i.type==='checkbox'){
     const keys=path.split('.');let sole=false;
     if(keys[0]==='appearances')sole=Object.values(read('appearances')).filter(a=>a.enabled).length===1;
     else if(keys[1]==='allowed')sole=policy().values(keys[0]).length===1;
     i.disabled=!!(sole&&current);
    }
   }
   for(const f of host.querySelectorAll('[data-auto-enabled]'))f.disabled=!read(f.dataset.autoEnabled);
   for(const update of summaries)update();
   const a=read('appearances');summary.textContent=Object.entries(a).filter(([,v])=>v.enabled).map(([k,v])=>(k==='rain'?'Rain':'Cloud')+(a.rain.enabled&&a.cloud.enabled?' '+secs(v):' only')).join(' ↔ ')+' · Camera: '+poolSummary('camera');
   ui.updateStatus(true);
  },
  updateStatus(force=false){
   if(!host||(!force&&performance.now()-stamp<250))return;stamp=performance.now();
   const p=policy(),active=p.running&&window.autoOrchestratorActive;
   resume.hidden=!active||!p.held;
   status.textContent=window.rainSessionControls?.stopped?'Paused':!active?'Ready — start Auto scenes when you want.':p.held?'Appearance cycle paused by your manual switch. Other selected changes continue.':p.status||'Starting…';
   host.dataset.phase=p.phase||'transition';host.dataset.autoRunning=String(!!active);
  }
 };
})();
