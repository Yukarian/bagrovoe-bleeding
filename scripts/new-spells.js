// Special blood spells use GM-confirmed utility activities, avoiding a second damage button.
(() => {
 const MOD='bagrovoe-bleeding',keys=new Set(['scarlet-thread','clotting-seal','crimson-step','transfusion','crimson-harvest','executioners-pulse']);
 const busy=new Set();let queue=Promise.resolve();
 const leader=()=>game.user?.isGM&&game.users.activeGM?.id===game.user.id;
 const keyOf=item=>item?.getFlag(MOD,'spellKey');
 const api=()=>game.modules.get(MOD).api;
 const bleed=t=>Number(api().get(t)?.getFlag(MOD,'level')??0);
 const escape=s=>foundry.utils.escapeHTML(String(s));
 function distance(a,b){
  if(!a||!b||a.parent?.id!==b.parent?.id)return Infinity;
  const size=a.parent.grid.size,unit=a.parent.grid.distance;
  const dx=Math.max(0,Math.abs(a.x+a.width*size/2-b.x-b.width*size/2)-(a.width+b.width-2)*size/2);
  const dy=Math.max(0,Math.abs(a.y+a.height*size/2-b.y-b.height*size/2)-(a.height+b.height-2)*size/2);
  return Math.hypot(dx,dy)*unit/size;
 }
 async function dialog(title,content,fields=[]){
  return foundry.applications.api.DialogV2.wait({window:{title},content,
   buttons:[{action:'ok',label:'Подтвердить',callback:(_e,b)=>Object.fromEntries(fields.map(k=>[k,Number(b.form.elements[k].value)]))},{action:'cancel',label:'Отмена',default:true,callback:()=>null}],rejectClose:false});
 }
 async function temp(actor,value){if(value>Number(actor.system.attributes.hp.temp??0))await actor.update({'system.attributes.hp.temp':value});}
 async function concentration(actor,value){
  if(actor.system.attributes.hp.value<=0){await actor.endConcentration?.();return;}
  if(value>0&&actor.statuses?.has('concentrating')){
   const rolls=await actor.rollConcentration({target:actor.getConcentrationDC?.(value)??Math.max(10,Math.floor(value/2))},{configure:false});
   if(rolls?.[0]?.isFailure)await actor.endConcentration?.();
  }
 }
 async function damage(actor,value){
  const hp=()=>Number(actor.system.attributes.hp.value)+Number(actor.system.attributes.hp.temp??0),before=hp();
  await actor.applyDamage([{value,type:'necrotic',properties:new Set(['mgc'])}]);
  await concentration(actor,Math.max(0,before-hp()));
 }
 function destination(token,dx,dy,max){
  if(!Number.isFinite(dx)||!Number.isFinite(dy))throw Error('Укажите числовое смещение.');
  const scene=token.parent,size=scene.grid.size,unit=scene.grid.distance;
  if(Math.hypot(dx,dy)*unit>max+0.001)throw Error('Место назначения слишком далеко.');
  const x=token.x+dx*size,y=token.y+dy*size;
  const dims=scene.dimensions;
  if(dims&&(x<dims.sceneX||y<dims.sceneY||x+token.width*size>dims.sceneX+dims.sceneWidth||y+token.height*size>dims.sceneY+dims.sceneHeight))throw Error('Место назначения за пределами сцены.');
  for(const other of scene.tokens??[]){if(other.id===token.id)continue;
   if(x<other.x+other.width*size&&x+token.width*size>other.x&&y<other.y+other.height*size&&y+token.height*size>other.y)throw Error('Место назначения занято другим токеном.');
  }
  return {x,y};
 }
 async function save(target,caster,chat){
  const dc=8+2*Number(caster.system.attributes.prof)+Number(caster.system.abilities.con.mod);
  const rolls=await target.actor.rollSavingThrow({ability:'con',target:dc},{configure:false},{data:{whisper:[...(chat.whisper??[])],blind:chat.blind}});
  if(!Number.isFinite(rolls?.[0]?.total))throw Error('Спасбросок не завершён.');
  if(rolls[0].total>=dc)return true;
  const choice=await foundry.applications.api.DialogV2.wait({window:{title:'Результат спасброска'},content:`<p>${escape(target.name)}: ${rolls[0].total} против Сл ${dc}. Если применяется легендарное сопротивление, спишите его на листе и выберите успех.</p>`,buttons:[{action:'fail',label:'Провал',default:true,callback:()=>false},{action:'success',label:'Успех (сопротивление)',callback:()=>true}],rejectClose:false});
  if(choice==null)throw Error('Результат спасброска не подтверждён.');return choice;
 }
 async function process(chat){
  if(!leader()||!['usage','attack'].includes(chat.type)||chat.getFlag(MOD,'newSpellResolution'))return;
  const activity=chat.getAssociatedActivity?.(),item=activity?.item,key=keyOf(item),caster=item?.actor;
  if(!keys.has(key)||!caster)return;
  if(key==='scarlet-thread'?chat.type!=='attack':chat.type!=='usage')return;
  if(busy.has(chat.id))return;busy.add(chat.id);
  try{await resolve(chat,activity,key,caster);}catch(error){
   console.error(MOD,error);ui.notifications.error(`${item.name}: ${error.message} Если часть эффекта уже применена, завершите вручную.`);
  }finally{busy.delete(chat.id);}
 }
 async function resolve(chat,activity,key,caster){
  if(chat.getFlag(MOD,'newSpellResolution'))return;
  if(!chat.author?.isGM&&!caster.testUserPermission?.(chat.author,'OWNER'))return;
  if(caster.type!=='npc'||!(caster.getFlag(MOD,'bloodMagic')||caster.system.details?.type?.subtype==='заражённый'))return;
  const self=chat.getAssociatedToken?.();if(!self?.actor||self.actor.uuid!==caster.uuid)throw Error('Сотворите заклинание от токена на сцене.');
  let targets=[];
  for(const row of chat.system.targets??[]){const t=await fromUuid(row.token);if(t?.actor&&!targets.some(x=>x.uuid===t.uuid))targets.push(t);}
  if(key==='scarlet-thread'){
   await globalThis.BagrovoeSpellRuntime.resolveAttack(chat);
   targets=targets.filter(t=>chat.system.evaluatedTargets?.some(h=>h.token===t.uuid&&h.isMiss===false)&&bleed(t)>0);
   if(!targets.length)return;
  }
  if(key!=='crimson-step'&&(!targets.length||(key!=='crimson-harvest'&&targets.length!==1)))throw Error('Выберите допустимое число целей и сотворите заклинание заново.');
  const range={ 'scarlet-thread':30,'clotting-seal':5,transfusion:30,'crimson-harvest':15,'executioners-pulse':60 }[key];
  if(targets.some(t=>distance(self,t)>range))throw Error('Цель вне дистанции или на другой сцене.');
  if(key==='transfusion'&&(targets[0].actor.uuid===caster.uuid||caster.system.attributes.hp.value<=1))throw Error('Нужно другое существо и минимум 2 текущих хита.');
  if(key==='executioners-pulse'&&!bleed(targets[0]))throw Error('Цель должна кровоточить.');
  const fields=key==='crimson-step'?['dx','dy']:key==='transfusion'?['hp']:[];
  const inputs=fields.map(k=>`<label>${k==='hp'?'Потеря хитов (1–15)':k==='dx'?'Клеток вправо (отрицательное — влево)':'Клеток вниз (отрицательное — вверх)'}<input name="${k}" type="number" value="${k==='hp'?1:0}" step="${k==='hp'?1:'any'}"></label>`).join('');
  const choice=await dialog(activity.item.name,`<p>Цели: ${targets.map(t=>escape(t.name)).join(', ')||escape(self.name)}.</p><p>Подтвердите видимость, согласие для помощи и попадание целей в конус. Для перемещения проверьте свободное место и путь притягивания. Цена сотворения уже оплачена.</p>${inputs}`,fields);
  if(choice==null){await chat.setFlag(MOD,'newSpellResolution','cancelled');return;}
  let dest;
  if(key==='crimson-step')dest=destination(self,choice.dx,choice.dy,30);
  if(key==='transfusion'&&(!Number.isInteger(choice.hp)||choice.hp<1||choice.hp>15||choice.hp>=caster.system.attributes.hp.value))throw Error('Потеряйте от 1 до 15 хитов, оставив минимум 1.');
  // Receipt precedes mutation: interrupted operations must be reconciled by the GM, never replayed.
  await chat.setFlag(MOD,'newSpellResolution','processing');
  const target=targets[0];
  if(key==='scarlet-thread'){
   const size=self.parent.grid.size,unit=self.parent.grid.distance;
   const dx=(self.x+self.width*size/2-target.x-target.width*size/2)/size,dy=(self.y+self.height*size/2-target.y-target.height*size/2)/size,len=Math.hypot(dx,dy);
   const travel=Math.min(10/unit,Math.max(0,len-(Math.max(self.width,self.height)+Math.max(target.width,target.height))/2));
   if(len&&travel)await target.update(destination(target,dx/len*travel,dy/len*travel,10));
  }
  if(key==='clotting-seal'){
   await api().stop(target);
   const previous=target.actor.effects.filter(e=>e.getFlag(MOD,'clottingSeal')===target.uuid);
   if(previous.length)await target.actor.deleteEmbeddedDocuments('ActiveEffect',previous.map(e=>e.id));
   await target.actor.createEmbeddedDocuments('ActiveEffect',[{name:activity.item.name,img:activity.item.img,origin:activity.item.uuid,transfer:false,changes:[],flags:{[MOD]:{clottingSeal:target.uuid,expires:{...globalThis.BagrovoeSpellRuntime.expiry(caster),start:true}}}}]);
  }
  if(key==='crimson-step'){
   await self.update(dest);
   if([...self.parent.tokens].some(t=>t.id!==self.id&&t.actor&&bleed(t)>0&&distance(self,t)<=5))await temp(caster,5);
  }
  if(key==='transfusion'){
   await caster.update({'system.attributes.hp.value':caster.system.attributes.hp.value-choice.hp});
   await target.actor.applyDamage([{value:choice.hp,type:'healing'}]);
  }
  if(['crimson-harvest','executioners-pulse'].includes(key)){
   const snapshots=targets.map(t=>({target:t,level:bleed(t)}));let bonus=0;
   const formula=key==='crimson-harvest'?'4d6':`${Math.min(9,4+snapshots[0].level)}d8`;
   const roll=await new Roll(formula).evaluate();
   await roll.toMessage({speaker:ChatMessage.getSpeaker({actor:caster}),flavor:`${activity.item.name}: урон обрабатывает модуль`,whisper:[...(chat.whisper??[])],blind:chat.blind});
   for(const {target:t,level} of snapshots){
    const success=await save(t,caster,chat);await damage(t.actor,success?Math.floor(roll.total/2):roll.total);
    if(!success&&level>0)bonus+=3;
    if(key==='executioners-pulse')await api().stop(t);
   }
   if(key==='crimson-harvest')await temp(caster,Math.min(9,bonus));
  }
  await chat.setFlag(MOD,'newSpellResolution','done');
  await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:caster}),content:`<p><strong>${escape(activity.item.name)}</strong>: эффект применён.${key==='scarlet-thread'?' Урон примените штатной кнопкой атаки.':' Повторно применять урон не нужно.'}</p>`,whisper:[...(chat.whisper??[])],blind:chat.blind});
 }
 const previous=globalThis.BagrovoeSpellRuntime.validateUse;
 globalThis.BagrovoeSpellRuntime.validateUse=(activity,usage,message)=>{
  if(previous(activity,usage,message)===false)return false;
  const key=keyOf(activity.item);if(!keys.has(key))return;
  const actor=activity.item.actor;
  if(actor?.type!=='npc'||!(actor.getFlag(MOD,'bloodMagic')||actor.system.details?.type?.subtype==='заражённый')){ui.notifications.warn('Эти заклинания предназначены для заражённых NPC.');return false;}
  if(!game.users.activeGM){ui.notifications.warn('Нужен активный ведущий.');return false;}
  const targets=message?.data?.system?.targets??[];
  if(key!=='crimson-step'&&(!targets.length||(key!=='crimson-harvest'&&targets.length!==1))){ui.notifications.warn('Выберите цели перед сотворением.');return false;}
 };
 globalThis.BagrovoeNewSpells={process,distance,destination,temp};
 for(const event of ['createChatMessage','updateChatMessage'])Hooks.on(event,chat=>{queue=queue.catch(()=>{}).then(()=>process(chat));});
})();
