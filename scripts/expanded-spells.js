// Native spell slots / concentration; GM-confirmed triggers for conditional homebrew effects.
(() => {
 const MOD='bagrovoe-bleeding', pending=new Set();let queue=Promise.resolve();
 const leader=()=>game.user?.isGM&&game.users.activeGM?.id===game.user.id;
 const api=()=>game.modules.get(MOD).api, blood=()=>api().bloodMagic;
 const living=a=>a&&!a.statuses?.has('dead')&&!['undead','construct'].includes(a.system.details?.type?.value);
 const level=t=>Number(api().get(t)?.getFlag(MOD,'level')??0);
 const dist=(a,b)=>globalThis.BagrovoeNewSpells.distance(a,b);
 const esc=s=>foundry.utils.escapeHTML(String(s??''));
 const world=()=>Number(game.time.worldTime);
 const tokens=()=>[...game.scenes].flatMap(s=>[...s.tokens]);
 const actors=()=>[...new Map([...game.actors,...tokens().map(t=>t.actor)].filter(Boolean).map(a=>[a.uuid,a])).values()];
 const spec=i=>i?.getFlag?.(MOD,'expandedSpell');
 const state=c=>c.getFlag(MOD,'expandedState');
 const report=e=>{console.error(MOD,e);ui.notifications.error(`Магия крови: ${e.message}. Если действие прервалось после расхода ресурса, проверьте листы перед ручным завершением.`);};
 const serial=fn=>{const p=queue.catch(()=>{}).then(fn);queue=p;return p;};
 async function ask(title,content,fields=[]){
  return foundry.applications.api.DialogV2.wait({window:{title},content,
   buttons:[{action:'ok',label:'Подтвердить',callback:(_e,b)=>Object.fromEntries(fields.map(k=>[k,Number(b.form.elements[k].value)]))},
    {action:'cancel',label:'Отмена',default:true,callback:()=>null}],rejectClose:false});
 }
 async function tell(chat,text){return ChatMessage.create({speaker:chat.speaker,content:`<p>${esc(text)}</p>`,whisper:ChatMessage.getWhisperRecipients('GM').map(u=>u.id)});}
 function selected(message){return (message?.data?.system?.targets??[]).map(r=>fromUuidSync(r.token));}
 function selfOf(item,message){const s=message?.data?.speaker??ChatMessage.getSpeaker({actor:item.actor});return item.actor.token??game.scenes.get(s.scene)?.tokens.get(s.token);}
 function dieAvailable(a){return blood().chooseDice(a,1).missing===0;}
 async function spendDie(a){return blood().spendAvailableDie(a);}
 function deathAllowed(caster,target,amount){
  const hp=target?.system.attributes.hp;if(!hp||!living(target)||hp.value<=0||target.getFlag(MOD,'deferredDeathUsed'))return false;
  const actual=Number(amount),threshold=Number(hp.value)+Number(hp.temp??0);
  return Number.isInteger(actual)&&actual>=threshold&&actual<threshold+Number(hp.max)&& (dieAvailable(target)||dieAvailable(caster));
 }
 function reactionBlocked(actor){return actor.effects.some(e=>!e.disabled&&e.getFlag(MOD,'reactionBan'));}
 const previous=globalThis.BagrovoeSpellRuntime.validateUse;
 globalThis.BagrovoeSpellRuntime.validateUse=(activity,usage,message)=>{
  if(previous(activity,usage,message)===false)return false;
  if((activity.activation?.type??activity.item?.system.activation?.type)==='reaction'&&reactionBlocked(activity.item.actor)){
   ui.notifications.warn('Срыв пульса: существо пока не может совершать реакции.');return false;
  }
  const item=activity.item,s=spec(item);if(!s)return;
  const warn=t=>{ui.notifications.warn(t);return false;};
  if(!game.user.isGM)return warn('Эти заклинания пока применяет ведущий: попросите его открыть ваш лист и сотворить заклинание.');
  if(!game.users.activeGM)return warn('Нужен активный ведущий.');
  if(item.getFlag(MOD,'resourceMode')==='hitDice'&&!(item.actor.type==='npc'&&(item.actor.getFlag(MOD,'bloodMagic')||item.actor.system.details?.type?.subtype==='заражённый')))return warn('Кровавое колдовство доступно заражённым NPC.');
  const self=selfOf(item,message),ts=selected(message);
  if(!self?.actor)return warn('Сотворите заклинание от токена на сцене.');
  if(ts.length<s.min||ts.length>s.max||ts.some(t=>!t?.actor))return warn(`Выберите от ${s.min} до ${s.max} целей.`);
  if(new Set(ts.map(t=>t.actor.uuid)).size!==ts.length)return warn('Нужны разные существа.');
  if(ts.some(t=>dist(self,t)>s.range))return warn('Цель вне дистанции заклинания.');
  if(s.key!=='pulse-disruption'&&ts.some(t=>!living(t.actor)))return warn('Нужны живые существа, кроме нежити и конструктов.');
  if(s.concentration&&game.settings.get('dnd5e','disableConcentration'))return warn('Для этого заклинания включите учёт концентрации в настройках D&D5e.');
  if(s.key==='vital-theft'&&!level(ts[0]))return warn('Цель должна кровоточить.');
  if(s.key==='donors-gift'&&!ts.some(t=>dieAvailable(t.actor)))return warn('Ни у одной цели нет доступной Кости Хитов.');
  const input=message?.data?.flags?.[MOD]?.expandedInput;
  if(input){
   if(s.key==='deferred-death'&&!deathAllowed(item.actor,ts[0].actor,input.damage))return warn('Условия отсроченной кончины не выполнены: проверьте урон, Кости Хитов и ограничение до отдыха.');
   if(s.concentration){usage.concentration??={};usage.concentration.begin=true;}
   if(s.key==='donors-gift'&&(![0,1].includes(input.donor)||!dieAvailable(ts[input.donor].actor)))return warn('У выбранного донора нет Кости Хитов.');
   return;
  }
  // Run confirmation before the existing blood-cost hook or native slot consumption.
  const id=activity.uuid;if(pending.has(id))return false;pending.add(id);
  void (async()=>{
   try{
    let content='<p>Подтвердите видимость и условия заклинания. Для помощи необходимо согласие целей.</p>',fields=[];
    if(s.key==='donors-gift'){
     fields=['donor'];content+=`<label>Донор<select name="donor">${ts.map((t,n)=>`<option value="${n}" ${dieAvailable(t.actor)?'':'disabled'}>${esc(t.name)}</option>`).join('')}</select></label>`;
    }
    if(s.key==='deferred-death'){
     fields=['damage'];content+='<p>Используйте ДО применения входящего урона. Укажите окончательный урон после всех защит. Модуль применит его один раз и оставит 1 хит. Не нажимайте затем кнопку исходного урона.</p><label>Входящий урон<input name="damage" type="number" min="1" step="1" required></label>';
    }
    const choice=await ask(item.name,content,fields);if(choice==null)return;
    message.data.flags??={};message.data.flags[MOD]??={};message.data.flags[MOD].expandedInput={...choice,confirmed:true};
    await activity.use(usage,{configure:item.getFlag(MOD,'resourceMode')==='slots'},message);
   }catch(e){report(e);}finally{pending.delete(id);}
  })();return false;
 };
 async function roll(formula,chat){const r=await new Roll(formula).evaluate();await r.toMessage({speaker:chat.speaker,flavor:'Эффект заклинания — применяется модулем',whisper:[...(chat.whisper??[])],blind:chat.blind});return r.total;}
 function dc(item){const a=item.actor,prof=Number(a.system.attributes.prof),divine=item.getFlag(MOD,'resourceMode')==='slots';return 8+(divine?prof:2*prof)+Number(a.system.abilities[divine?(item.system.ability||a.system.attributes.spellcasting||'wis'):'con'].mod);}
 async function save(t,ability,item,chat){
  const target=dc(item),rs=await t.actor.rollSavingThrow({ability,target},{configure:true},{data:{whisper:[...(chat.whisper??[])],blind:chat.blind}});
  if(!Number.isFinite(rs?.[0]?.total))throw Error('Спасбросок не завершён');
  if(rs[0].isSuccess===true||rs[0].total>=target)return true;
  const result=await foundry.applications.api.DialogV2.wait({window:{title:`${t.name}: спасбросок`},content:`<p>${rs[0].total} против Сл ${target}. При легендарном сопротивлении спишите его на листе.</p>`,buttons:[{action:'fail',label:'Провал',default:true,callback:()=>false},{action:'success',label:'Успех / сопротивление',callback:()=>true}],rejectClose:false});
  if(result==null)throw Error('Результат спасброска не подтверждён');return result;
 }
 async function damage(actor,value,type='necrotic',extra={}){
  const hp=()=>Number(actor.system.attributes.hp.value)+Number(actor.system.attributes.hp.temp??0),before=hp();
  if(type==='final')await actor.applyDamage(value,{ignore:true,...extra});else await actor.applyDamage([{value,type,properties:new Set(['mgc'])}]);
  const lost=Math.max(0,before-hp());
  if(actor.system.attributes.hp.value<=0)await actor.endConcentration?.();
  else if(lost&&actor.statuses?.has('concentrating')){const rs=await actor.rollConcentration({target:actor.getConcentrationDC?.(lost)??Math.max(10,Math.floor(lost/2))},{configure:true});if(rs?.[0]?.isFailure)await actor.endConcentration?.();}
 }
 function effectState(e){return e.getFlag(MOD,'expandedCast');}
 function aliveCast(e){
  const s=effectState(e);if(!s||e.disabled||world()>=s.until)return false;
  if(s.combat){const c=game.combats.get(s.combat);if(!c||Number(c.round)>s.roundEnd||(Number(c.round)===s.roundEnd&&Number(c.turn)>=s.turnEnd))return false;}
  if(s.concentration&&!e.parent.effects.get(s.concentration))return false;
  const self=fromUuidSync(s.self);if(!self?.actor)return false;
  if(s.key==='shared-pain'){const [a,b]=s.targets.map(u=>fromUuidSync(u));if(!a?.actor||!b?.actor||!living(a.actor)||!living(b.actor)||dist(a,b)>60)return false;}
  return true;
 }
 function casts(key){return actors().flatMap(a=>[...a.effects]).filter(e=>effectState(e)?.key===key&&aliveCast(e));}
 async function addCast(chat,item,self,ts){
  const s=spec(item),combat=game.combat?.started?game.combat:null;
  const entry={key:s.key,chat:chat.id,self:self.uuid,targets:ts.map(t=>t.uuid),until:world()+s.seconds,concentration:s.concentration?chat.system.concentration:null,
   combat:combat?.id??null,roundEnd:combat?Number(combat.round)+Math.ceil(s.seconds/6):null,turnEnd:combat?.turn??null};
  if(s.concentration&&!entry.concentration)throw Error('Концентрация не начата. Включите её в окне сотворения');
  const [e]=await item.actor.createEmbeddedDocuments('ActiveEffect',[{name:item.name,img:item.img,origin:item.uuid,transfer:false,changes:[],duration:{seconds:s.seconds,startTime:world()},flags:{[MOD]:{expandedCast:entry}}}]);return e;
 }
 async function process(chat){
  if(!leader()||chat.type!=='usage'||state(chat))return;
  const item=chat.getAssociatedActivity?.()?.item,s=spec(item);if(!s||!chat.author?.isGM)return;
  const self=chat.getAssociatedToken?.(),ts=(chat.system.targets??[]).map(r=>fromUuidSync(r.token)),input=chat.getFlag(MOD,'expandedInput');
  if(!self?.actor||self.actor.uuid!==item.actor.uuid||ts.some(t=>!t?.actor)||!input?.confirmed)throw Error('Нет подтверждённых целей или токена заклинателя');
  await chat.setFlag(MOD,'expandedState',{status:'processing'});
  const t=ts[0],key=s.key;
  if(key==='donors-gift'){
   const donor=ts[input.donor],recipient=ts[1-input.donor];if(!living(donor?.actor)||!living(recipient?.actor))throw Error('Нужны живые донор и получатель');
   const die=await spendDie(donor.actor),amount=await roll(`1d${die}`,chat)+Number(item.actor.system.abilities.wis.mod);
   await recipient.actor.applyDamage([{value:Math.max(0,amount),type:'healing'}]);
  }else if(key==='deferred-death'){
   if(!deathAllowed(item.actor,t.actor,input.damage))throw Error('Условия отсроченной кончины изменились');
   await spendDie(dieAvailable(t.actor)?t.actor:item.actor);
   await t.actor.setFlag(MOD,'deferredDeathUsed',true);
   await damage(t.actor,input.damage,'final',{ortesDeathGuard:true});
  }else if(['pulse-disruption','vital-theft'].includes(key)){
   const success=await save(t,'con',item,chat),amount=await roll(key==='pulse-disruption'?'3d6':'3d8',chat);
   if(!success&&key==='vital-theft'&&living(t.actor)&&level(t))await blood().steal(item.actor,t.actor,1);
   await damage(t.actor,success?Math.floor(amount/2):amount);
   if(!success&&key==='pulse-disruption')await t.actor.createEmbeddedDocuments('ActiveEffect',[{name:'Срыв пульса: нет реакций',img:item.img,origin:item.uuid,transfer:false,changes:[],flags:{[MOD]:{reactionBan:true,expires:{...globalThis.BagrovoeSpellRuntime.expiry(item.actor),start:true}}}}]);
  }else{
   if(key==='penance'&&await save(t,'wis',item,chat)){await chat.setFlag(MOD,'expandedState',{status:'saved'});return;}
   if(key==='communion-mark'){
    const existing=casts(key).filter(e=>e.parent.uuid===item.actor.uuid).sort((a,b)=>effectState(a).until-effectState(b).until);
    const same=existing.filter(e=>effectState(e).targets.includes(t.uuid));for(const e of same)await e.delete();
    const rest=existing.filter(e=>!same.includes(e));while(rest.length>=Math.max(1,Number(item.actor.system.attributes.prof)))await rest.shift().delete();
   }
   const effect=await addCast(chat,item,self,ts);await chat.setFlag(MOD,'expandedState',{status:'active',effect:effect.uuid,used:{}});return;
  }
  await chat.setFlag(MOD,'expandedState',{status:'done'});await tell(chat,`${item.name}: эффект применён; повторно применять урон или лечение не нужно.`);
 }
 function turnKey(){const c=game.combat;return c?.started?`${c.id}:${c.round}:${c.turn}`:`time:${Math.floor(world()/6)}`;}
 function ownTurn(token){return !game.combat?.started||game.combat.combatant?.actor?.uuid===token.actor.uuid;}
 function inArea(template,t){
  if(!template||template.parent.id!==t.parent.id)return false;
  const size=t.parent.grid.size,unit=t.parent.grid.distance;
  return Math.hypot(t.x+t.width*size/2-template.x,t.y+t.height*size/2-template.y)*unit/size<=Number(template.distance)+0.001;
 }
 async function templateFor(chat,item,self){
  const current=state(chat);if(current.template){const t=await fromUuid(current.template);if(!t)throw Error('Шаблон области удалён');return t;}
  const origin=chat.getAssociatedActivity().uuid;
  const matches=[...self.parent.templates].filter(t=>t.getFlag('dnd5e','origin')===origin);
  if(matches.length!==1)throw Error('Оставьте на сцене один шаблон этого заклинания и повторите действие');
  const t=matches[0],grid=self.parent.grid;
  if(Math.hypot(t.x-(self.x+self.width*grid.size/2),t.y-(self.y+self.height*grid.size/2))*grid.distance/grid.size>spec(item).range)throw Error('Шаблон вне дистанции сотворения');
  await chat.setFlag(MOD,'expandedState',{...current,template:t.uuid});return t;
 }
 async function trigger(chat,action){
  if(!leader())return;
  const st=state(chat),effect=st?.effect?await fromUuid(st.effect):null;
  if(!effect||!aliveCast(effect))throw Error('Действие заклинания уже закончилось');
  const item=chat.getAssociatedActivity?.()?.item,s=effectState(effect),self=fromUuidSync(s.self);if(!spec(item))return;
  if(action==='end'){await finishCast(effect);return;}
  if(st.busy)throw Error('Прошлое действие прервалось; проверьте листы вручную');
  const ts=s.targets.map(u=>fromUuidSync(u)).filter(t=>t?.actor),key=s.key;
  if(action==='sense'){
   if(key==='communion-mark'){
    const t=ts[0];await tell(chat,dist(self,t)<=60?`${t.name}: ${t.actor.system.attributes.hp.value>0&&!t.actor.statuses?.has('unconscious')?'в сознании':'без сознания'}; ${level(t)>0?'кровоточит':'не кровоточит'}.`:'Метка вне досягаемости.');return;
   }
   const template=key==='scarlet-veil'?await templateFor(chat,item,self):null;
   if(template&&!inArea(template,self))throw Error('Заклинатель должен находиться внутри завесы');
   const nearby=[...self.parent.tokens].filter(t=>living(t.actor)&&level(t)>0&&(template?inArea(template,t):dist(self,t)<=30));
   await tell(chat,template?`Алая завеса: ${nearby.map(t=>`${t.name} (${Math.round(t.x)}, ${Math.round(t.y)})`).join('; ')||'кровоточащих нет'}. Это ощущение положения, не зрение.`:`Эхо пульса: кандидатов ${nearby.length}. Ведущий исключает существ за полным укрытием и сообщает только наличие и число: ${nearby.map(t=>t.name).join(', ')||'нет'}.`);return;
  }
  let targets=ts,fields=[],content='<p>Подтвердите условия срабатывания и доступность реакции, если она требуется.</p>',template;
  if(['crimson-thorns','cathedral-of-wounds'].includes(key)){
   template=await templateFor(chat,item,self);targets=[...game.user.targets].map(t=>t.document??t);
   if(!targets.length||targets.some(t=>!living(t.actor)||!inArea(template,t)))throw Error('Выберите живые цели внутри области');
   if(key==='cathedral-of-wounds'&&targets.some(t=>!level(t)||!ownTurn(t)))throw Error('Нужно кровоточащее существо в начале его хода');
   content+=`<p>${key==='crimson-thorns'?'Первое добровольное перемещение внутри области за текущий ход. Вынужденное перемещение не подходит.':'Начало хода кровоточащей цели.'}</p>`;
  }
  if(key==='penance'){
   if(!ownTurn(ts[0]))throw Error('Это происходит только в собственный ход цели');
   content+=`<p>${action==='save'?'Конец хода: повторный спасбросок Мудрости.':'Цель впервые за свой ход нанесла урон другому существу. Ответный урон Епитимьи не запускает другую Епитимью.'}</p>`;
  }
  if(key==='shared-pain'){
   fields=['victim','damage'];content+=`<p>Используйте ДО применения входящего урона. Укажите окончательный урон после защит. Модуль разделит и применит его обоим один раз. Второй участник тратит реакцию. Исходный урон повторно не применяйте.</p><label>Пострадавший<select name="victim">${ts.map((t,n)=>`<option value="${n}">${esc(t.name)}</option>`).join('')}</select></label><label>Урон<input name="damage" type="number" min="1" step="1" required></label>`;
  }
  if(key==='litany-of-endurance'){await tell(chat,'В пределах 15 футов от заклинателя отмеченные союзники получают преимущество против испуга; выберите его в окне спасброска. Урон кровотечения модуль уменьшает автоматически.');return;}
  const choice=await ask(item.name,content,fields);if(choice==null)return;
  const receipts={...(state(chat).used??{})},ids=targets.map(t=>`${action}:${t.actor.uuid}:${turnKey()}`);
  if(ids.some(id=>receipts[id]))throw Error('Этот эффект уже обработан в текущем ходу');
  if(key==='shared-pain'){
   if(![0,1].includes(choice.victim)||!Number.isInteger(choice.damage)||choice.damage<1)throw Error('Укажите цель и целое положительное число урона');
   const receiver=ts[1-choice.victim].actor;
   if(reactionBlocked(receiver))throw Error('Второй участник не может реагировать');
   const c=game.combat,index=c?.turns?.findIndex(x=>x.actor?.uuid===receiver.uuid)??-1;
   const reaction=c?.started?`${c.id}:${c.round-(c.turn<index?1:0)}`:turnKey();
   if(receiver.getFlag(MOD,'sharedPainReaction')===reaction)throw Error('Реакция связи уже потрачена');
   await receiver.setFlag(MOD,'sharedPainReaction',reaction);
   await chat.setFlag(MOD,'expandedState',{...state(chat),busy:true});
   const half=Math.floor(choice.damage/2);await damage(ts[choice.victim].actor,choice.damage-half,'final');await damage(receiver,half,'final');
   await chat.setFlag(MOD,'expandedState',{...state(chat),busy:false});return;
  }
  if(state(chat).busy)throw Error('Прошлое действие прервалось; проверьте листы вручную');
  for(const id of ids)receipts[id]=true;await chat.setFlag(MOD,'expandedState',{...state(chat),used:receipts});
  if(key==='penance'){
   if(action==='save'){if(await save(ts[0],'wis',item,chat))await finishCast(effect);}
   else await damage(ts[0].actor,await roll('2d6',chat));return;
  }
  for(const t of targets){
   const success=await save(t,key==='crimson-thorns'?'dex':'con',item,chat),amount=await roll(key==='crimson-thorns'?'2d4':'3d8',chat);
   if(key==='crimson-thorns'){
    if(!success){const old=api().get(t),n=level(t);await damage(t.actor,amount,'piercing');if(n>0)await api().set(t,{level:Math.min(5,n+1),count:old.getFlag(MOD,'count')??1,dc:old.getFlag(MOD,'dc')??11});}
   }else await damage(t.actor,success?Math.floor(amount/2):amount);
  }
 }
 function reduceBleedingDamage(token,amount){
  return casts('litany-of-endurance').some(e=>{const s=effectState(e),self=fromUuidSync(s.self);return s.targets.includes(token.uuid)&&living(token.actor)&&dist(self,token)<=15;})?Math.floor(amount/2):amount;
 }
 async function finishCast(effect){const s=effectState(effect);await effect.delete();if(s?.concentration)await effect.parent.endConcentration(s.concentration);}
 async function cleanup(){if(!leader())return;for(const a of actors())for(const e of [...a.effects])if(effectState(e)&&!aliveCast(e))await finishCast(e);}
 Hooks.on('dnd5e.preApplyDamage',(_actor,_amount,updates,options)=>{if(options.ortesDeathGuard===true)updates['system.attributes.hp.value']=1;});
 Hooks.on('dnd5e.restCompleted',(actor,result,config)=>{if(result.longRest||config?.type==='long')void actor.unsetFlag(MOD,'deferredDeathUsed').catch(report);});
 Hooks.on('createChatMessage',chat=>{void serial(()=>process(chat)).catch(report);});
 for(const event of ['updateWorldTime','updateCombat','deleteCombat','deleteActiveEffect','updateToken','ready'])Hooks.on(event,()=>{void serial(cleanup).catch(report);});
 Hooks.on('renderChatMessageHTML',(chat,html)=>{
  if(!leader())return;const item=chat.getAssociatedActivity?.()?.item,s=spec(item),st=state(chat);if(!s||st?.status!=='active')return;
  const root=html instanceof HTMLElement?html:html[0];if(!root||root.querySelector('[data-ortes-spell]'))return;
  const box=document.createElement('div');box.dataset.ortesSpell=chat.id;
  const actions=['communion-mark','pulse-echo','scarlet-veil'].includes(s.key)?[['sense','Ощутить']]:s.key==='penance'?[['trigger','Ответный урон'],['save','Спасбросок в конце хода']]:s.key==='litany-of-endurance'?[['trigger','Условия ауры']]:[['trigger',s.key==='shared-pain'?'Разделить входящий урон':'Применить к выбранным целям']];
  actions.push(['end','Завершить эффект']);
  for(const [action,label] of actions){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>{b.disabled=true;void serial(()=>trigger(chat,action)).catch(report).finally(()=>{b.disabled=false;});});box.append(b);}
  root.append(box);
 });
 globalThis.BagrovoeExpandedSpells={process,trigger,cleanup,reduceBleedingDamage,deathAllowed,inArea,aliveCast,dc,spendDie,reactionBlocked};
})();
