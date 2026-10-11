const MOD='bagrovoe-bleeding';
const KEYS=new Set(['last-stitch','scarlet-bracelet','crimson-lens','shared-pain','open-wound','living-ink','second-heart']);
const costs={'last-stitch':1,'scarlet-bracelet':1,'crimson-lens':0,'shared-pain':1,'open-wound':1,'living-ink':1,'second-heart':2};
const queues=new Map();
const leader=()=>game.user?.isGM&&game.users?.activeGM?.id===game.user.id;
const relicKey=i=>i?.getFlag?.(MOD,'relicKey');
const esc=s=>foundry.utils.escapeHTML(String(s??''));
function queue(key,fn){const p=(queues.get(key)??Promise.resolve()).catch(()=>{}).then(fn);queues.set(key,p);p.then(()=>{if(queues.get(key)===p)queues.delete(key);},()=>{if(queues.get(key)===p)queues.delete(key);});return p;}
const report=e=>{console.error(MOD,e);ui.notifications.error(`Реликвии: ${e.message}`);};
function pools(actor){return actor.items.filter(i=>i.type==='class').map(i=>({item:i,size:Number(String(i.system.hd?.denomination??'d8').slice(1)),left:Math.max(0,Number(i.system.levels)-Number(i.system.hd?.spent??0)),spent:Number(i.system.hd?.spent??0)}));}
function planDice(actor,count,selection='auto'){
 const all=pools(actor).filter(p=>selection==='auto'||p.item.id===selection).sort((a,b)=>a.size-b.size);
 const plan=[];let left=count;
 for(const p of all){const n=Math.min(left,p.left);if(n){plan.push({...p,count:n});left-=n;}}
 if(left)throw Error('Недостаточно Костей Хитов. Потеря HP не заменяет цену реликвии.');return plan;
}
function useLimit(item,actor){return item.system.uses?.max==='@prof'?Number(actor.system.attributes.prof):Number(item.system.uses?.max??0);}
function checkItem(item,actor){
 if(actor.type!=='character')throw Error('Эти реликвии предназначены для персонажей игроков.');
 if(Number(item.system.quantity??0)<1)throw Error('Предмет израсходован.');
 if(item.system.attunement==='required'&&!item.system.attuned)throw Error('Сначала настройтесь на предмет.');
 if(item.type==='equipment'&&!item.system.equipped)throw Error('Сначала наденьте предмет в листе персонажа.');
 if(Number(item.system.uses?.spent??0)>=useLimit(item,actor))throw Error('Применения закончились. Нужен продолжительный отдых.');
}
function ownToken(actor){return actor.token??actor.getActiveTokens?.(true,true)?.[0]??null;}
function turnKey(actor,source){const c=game.combat;return c?.started?`${c.id}:${c.round}:${c.turn}`:`outside:${source}`;}
function bleeding(token){const e=game.modules.get(MOD).api.get(token);return Boolean(e&&!e.disabled&&!e.isSuppressed);}
function sourceCandidates(key,actor,target){
 const messages=[...(game.messages?.contents??[])].reverse();
 return messages.filter(m=>{
  const a=m.getAssociatedActivity?.();if(a?.item?.actor?.uuid!==actor.uuid)return false;
  if(key==='open-wound')return m.type==='attack'&&(m.system.evaluatedTargets??[]).some(t=>t.token===target?.uuid&&t.isMiss===false);
  if(key==='shared-pain')return m.type==='healing'&&a.item.type==='spell';
  if(key==='living-ink')return m.type==='save'&&a.item.type==='spell'&&m.getAssociatedActor?.()?.uuid===target?.actor?.uuid&&!m.system.resisted&&!m.system.forceSuccess&&Number.isFinite(a.save?.dc?.value)&&m.rolls?.[0]?.total>=a.save.dc.value;
  return false;
 }).slice(0,20);
}
function prepareSaveReduction(roll,amount){
 const data=roll.toJSON();if(!Number.isFinite(data.total))throw Error('Невозможно изменить этот спасбросок.');
 data.total-=amount;data.formula=`${data.formula} - ${amount}`;
 data.terms.push({class:'OperatorTerm',operator:'-',options:{}},{class:'NumericTerm',number:amount,options:{}});
 return data;
}
async function concentration(actor,damage){
 if(damage>0&&actor.system.attributes.hp.value>0&&actor.statuses?.has('concentrating')){
  const dc=actor.getConcentrationDC?.(damage)??Math.max(10,Math.floor(damage/2));
  const rolls=await actor.rollConcentration({target:dc},{configure:false});
  if(rolls?.[0]?.isFailure)await actor.endConcentration?.();
 }
}
async function execute(item,actor,target,input,request){
 if(!leader())throw Error('Реликвию применяет только активный ведущий.');
 if(request.getFlag(MOD,'relicResolution'))throw Error('Этот запрос уже обработан.');
 checkItem(item,actor);const key=relicKey(item),self=ownToken(actor);
 if(!KEYS.has(key))throw Error('Неизвестная реликвия.');
 const api=game.modules.get(MOD).api;
 if(['last-stitch','crimson-lens','shared-pain','open-wound','living-ink'].includes(key)&&!target?.actor)throw Error('Выберите цель токеном (T).');
 if(['shared-pain','second-heart'].includes(key)&&!self)throw Error('Токен владельца должен находиться на сцене.');
 if(key==='last-stitch'&&!bleeding(target))throw Error('Цель не кровоточит.');
 if(key==='crimson-lens'&&!bleeding(target))throw Error('Линза отмечает только кровоточащую цель.');
 if(key==='shared-pain'&&target.actor.uuid===actor.uuid)throw Error('Чётки усиливают лечение другого существа.');
 const source=['open-wound','shared-pain','living-ink'].includes(key)?sourceCandidates(key,actor,target).find(m=>m.id===input.source):null;
 if(['open-wound','shared-pain','living-ink'].includes(key)&&!source)throw Error('Подходящее событие не найдено или его результат изменился.');
 const c=game.combat;
 const ownTurn=c?.turns?.findIndex(t=>t.actor?.uuid===actor.uuid)??-1;
 const reactionKey=c?.started?`${c.id}:${c.round-(c.turn<ownTurn?1:0)}`:request.id;
 if(['scarlet-bracelet','living-ink'].includes(key)&&actor.getFlag(MOD,'relicReaction')===reactionKey)throw Error('Реакция реликвии уже потрачена до начала следующего хода.');
 if(key==='open-wound'&&c?.started&&c.combatant?.actor?.uuid!==actor.uuid)throw Error('Перстень используется только в свой ход.');
 const turn=turnKey(actor,source?.id??request.id);
 if(['open-wound','shared-pain'].includes(key)&&actor.getFlag(MOD,`relicTurns.${key}`)===turn)throw Error('Это свойство уже использовано в текущий ход.');
 const receiptKey=`${actor.uuid.replaceAll('.','_')}_${key}`;
 if(source&&source.getFlag(MOD,`relicUsed.${receiptKey}`))throw Error('Это событие уже использовано для реликвии.');
 const hp=actor.system.attributes.hp,damage=Number(input.damage);
 if(['scarlet-bracelet','second-heart'].includes(key)&&(!Number.isFinite(damage)||damage<=0))throw Error('Введите положительный урон после защит, до временных хитов.');
 if(key==='second-heart'&&(hp.value<=0||damage<(hp.temp??0)+hp.value||damage-(hp.temp??0)-hp.value>=(hp.effectiveMax??hp.max)))throw Error('Сердце работает только при падении с положительных HP до нуля без мгновенной смерти.');
 let castingMod=0;
 if(key==='shared-pain'){
  const ability=input.ability;if(!['int','wis','cha'].includes(ability))throw Error('Выберите заклинательную характеристику.');
  castingMod=Number(actor.system.abilities[ability]?.mod??0);
 }
 const dice=planDice(actor,costs[key],input.pool);
 const rolled=[];if(['scarlet-bracelet','shared-pain','living-ink','second-heart'].includes(key))for(const p of dice)for(let n=0;n<p.count;n++)rolled.push((await new Roll(`1d${p.size}`).evaluate()).total);
 const sum=rolled.reduce((n,v)=>n+v,0);
 const penalty=key==='living-ink'?(await new Roll('1d4').evaluate()).total:0;
 const saveData=key==='living-ink'?prepareSaveReduction(source.rolls[0],penalty):null;
 // Persist a receipt before mutations. A partial failure is reported, never replayed blindly.
 await request.setFlag(MOD,'relicResolution',{status:'applying',item:item.uuid});
 for(const p of dice)await p.item.update({'system.hd.spent':p.spent+p.count});
 const update={'system.uses.spent':Number(item.system.uses.spent??0)+1};
 if(key==='last-stitch') {update['system.quantity']=Math.max(0,item.system.quantity-1);update['system.uses.spent']=0;}
 await item.update(update);
 if(['open-wound','shared-pain'].includes(key))await actor.setFlag(MOD,`relicTurns.${key}`,turn);
 if(source)await source.setFlag(MOD,`relicUsed.${receiptKey}`,request.id);
 if(['scarlet-bracelet','living-ink'].includes(key))await actor.setFlag(MOD,'relicReaction',reactionKey);
 let result='';
 if(key==='last-stitch'){await api.stop(target,'Нить последнего шва');result='Кровотечение остановлено; нить израсходована.';}
 if(key==='scarlet-bracelet'){
  const reduction=sum+Number(actor.system.attributes.prof),remaining=Math.max(0,damage-reduction);
  await actor.applyDamage(remaining);await concentration(actor,remaining);result=`Снижение: ${reduction}. Применено ${remaining} урона вместо ${damage}. Не применяйте исходный урон повторно.`;
 }
 if(key==='crimson-lens'){
  const old=actor.effects.filter(e=>e.getFlag(MOD,'relicMark'));if(old.length)await actor.deleteEmbeddedDocuments('ActiveEffect',old.map(e=>e.id));
  await actor.createEmbeddedDocuments('ActiveEffect',[{name:item.name,img:item.img,origin:item.uuid,transfer:false,disabled:false,changes:[],flags:{[MOD]:{relicMark:target.uuid,relicItem:item.id,expires:globalThis.BagrovoeSpellRuntime.expiry(actor)}}}]);
  result=`Отмечена цель: ${esc(target.name)}. Дополнительный урон при попадании применяется отдельно автоматически. Местоположение, дистанцию и преграды сообщает ведущий.`;
 }
 if(key==='shared-pain'){
  const healing=Math.max(1,sum+castingMod);await target.actor.applyDamage([{value:healing,type:'healing'}]);
  await api.apply(self,{levels:1,count:1,dc:11});result=`Цель дополнительно восстановила ${healing} HP. Владелец получил 1 уровень кровотечения.`;
 }
 if(key==='open-wound'){
  const dc=8+Number(actor.system.attributes.prof)+Number(actor.system.abilities.con.mod);
  const rolls=await target.actor.rollSavingThrow({ability:'con',target:dc},{configure:false});
  if(!Number.isFinite(rolls?.[0]?.total))throw Error('Спасбросок не завершён; цена уже оплачена. Ведущий должен завершить эффект вручную.');
  const failed=rolls[0].total<dc;if(failed)await api.apply(target,{levels:1,count:1,dc});
  result=`Телосложение ${rolls[0].total} против Сл ${dc}: ${failed?'наложен 1 уровень кровотечения':'успех, кровотечение не добавлено'}.`;
 }
 if(key==='living-ink'){
  const instantDeath=sum-hp.value>=(hp.effectiveMax??hp.max);
  await actor.update({'system.attributes.hp.value':Math.max(0,hp.value-sum),...(instantDeath?{'system.attributes.death.failure':3,'system.attributes.death.success':0}:{})});
  await source.update({rolls:[saveData,...source.rolls.slice(1).map(r=>r.toJSON())]});
  if(actor.system.attributes.hp.value===0){await actor.toggleStatusEffect(instantDeath?'dead':'unconscious',{active:true});await actor.endConcentration?.();}
  else await concentration(actor,sum);
  result=`Цена: ${sum} HP в обход защит и временных хитов. Спасбросок цели уменьшен на ${penalty}, итог ${saveData.total}. Повторно проверьте результат на карточке заклинания.`;
 }
 if(key==='second-heart'){
  await actor.update({'system.attributes.hp.value':1,'system.attributes.hp.temp':sum});
  await concentration(actor,damage);
  await api.apply(self,{levels:2,count:1,dc:11});
  result=`Вместо падения до нуля: 1 HP и ${sum} временных хитов, затем 2 уровня кровотечения. Входящий удар уже учтён: не применяйте его повторно.`;
 }
 await request.setFlag(MOD,'relicResolution',{status:'done',result});
 await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),content:`<p><strong>${esc(item.name)}</strong>: ${result}</p><p>Потрачено Костей Хитов: ${costs[key]}${rolled.length?`; броски: ${rolled.join(', ')}`:''}.</p>`});
 return result;
}
async function processRequest(chat){
 if(!leader()||chat.type!=='usage')return;
 const activity=chat.getAssociatedActivity?.(),actor=activity?.item?.actor;
 if(!actor||!KEYS.has(relicKey(activity.item)))return;
 const item=actor.items.get(activity.item.id);if(!item||!KEYS.has(relicKey(item)))return;
 // Never accept a request for an actor the message author does not control.
 if(!chat.author?.isGM&&!actor.testUserPermission(chat.author,'OWNER'))return;
 return queue(actor.uuid,async()=>{
  if(chat.getFlag(MOD,'relicResolution'))return;
  checkItem(item,actor);const key=relicKey(item);
  const descriptors=chat.system.targets??[];
  if(descriptors.length>1)throw Error('Выберите не больше одной цели.');
  const target=descriptors[0]?.token?await fromUuid(descriptors[0].token):ownToken(actor);
  const sources=sourceCandidates(key,actor,target);
  const needsSource=['open-wound','shared-pain','living-ink'].includes(key);
  if(needsSource&&!sources.length)throw Error('Нет подходящего броска в чате. Сначала выполните атаку, лечение или спасбросок и выберите цель.');
  const all=pools(actor);
  let content=`<p><strong>${esc(actor.name)} — ${esc(item.name)}</strong></p><p>Ведущий: подтвердите дистанцию, видимость, доступность действия/реакции и условие активации. Цена: ${costs[key]} КХ; замены на HP нет.</p>`;
  if(costs[key])content+=`<label>Какие Кости Хитов расходовать<select name="pool"><option value="auto">Из доступных, начиная с меньших</option>${all.map(p=>`<option value="${p.item.id}">${esc(p.item.name)}: ${p.left}к${p.size}</option>`).join('')}</select></label>`;
  if(needsSource)content+=`<label>Событие<select name="source">${sources.map(m=>`<option value="${m.id}">${esc(m.getAssociatedActivity()?.item?.name)} — ${esc(m.id)}</option>`).join('')}</select></label>`;
  if(key==='shared-pain')content+='<p>Подтвердите, что выбранная цель уже получила обычное лечение этого заклинания.</p><label>Характеристика<select name="ability"><option value="wis">Мудрость</option><option value="cha">Харизма</option><option value="int">Интеллект</option></select></label>';
  if(['scarlet-bracelet','second-heart'].includes(key))content+='<p>Только обычный входящий урон — не кровотечение и не кровавая цена. Введите урон ПОСЛЕ сопротивлений и других защит, ДО временных хитов. Он ещё не должен быть применён. Предмет сам учтёт этот удар.</p><label>Урон<input name="damage" type="number" min="1" step="1" required></label>';
  if(key==='living-ink')content+='<p>Спасбросок должен быть успешным, без легендарного сопротивления. Подтвердите наличие реакции и настройку заклинателем.</p>';
  const input=await foundry.applications.api.DialogV2.wait({window:{title:item.name},content,buttons:[
   {action:'apply',label:'Подтвердить и применить',callback:(_e,b)=>Object.fromEntries(new FormData(b.form).entries())},
   {action:'cancel',label:'Отмена',default:true,callback:()=>null}],rejectClose:false});
  if(input==null){await chat.setFlag(MOD,'relicResolution',{status:'cancelled'});return;}
  await execute(item,actor,target,input,chat);
 });
}
async function lensHit(chat){
 if(!leader()||chat.type!=='attack')return;
 const actor=chat.getAssociatedActivity?.()?.item?.actor;if(!actor)return;
 await globalThis.BagrovoeSpellRuntime?.resolveAttack(chat);
 await globalThis.BagrovoeSpellRuntime?.expireControls();
 return queue(actor.uuid,async()=>{
  const mark=actor.effects.find(e=>!e.disabled&&e.getFlag(MOD,'relicMark'));if(!mark)return;
  const item=actor.items.get(mark.getFlag(MOD,'relicItem'));
  if(!item?.system.attuned||!item.system.equipped)return;
  const token=mark.getFlag(MOD,'relicMark');
  if(!(chat.system.evaluatedTargets??[]).some(t=>t.token===token&&t.isMiss===false))return;
  const key=turnKey(actor,chat.id);if(actor.getFlag(MOD,'lensTurn')===key||chat.getFlag(MOD,'lensDamage'))return;
  const target=await fromUuid(token);if(!target?.actor)return;
  const roll=await new Roll('1d4').evaluate();
  await actor.setFlag(MOD,'lensTurn',key);await chat.setFlag(MOD,'lensDamage',roll.total);
  await target.actor.applyDamage([{value:roll.total,type:'necrotic',properties:new Set(['mgc'])}]);
  await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),content:`<p><strong>Линза багрового следа:</strong> отдельно применено ${roll.total} некротического урона с учётом защит цели.</p>`});
 });
}
Hooks.on('dnd5e.preUseActivity',activity=>{
 if(!KEYS.has(relicKey(activity.item)))return;
 if(!game.users?.activeGM){ui.notifications.warn('Для реликвий нужен активный ведущий.');return false;}
 try{checkItem(activity.item,activity.item.actor);planDice(activity.item.actor,costs[relicKey(activity.item)]);}catch(e){ui.notifications.warn(e.message);return false;}
});
Hooks.on('createChatMessage',chat=>{
 void processRequest(chat).catch(async error=>{
  if(chat.getFlag(MOD,'relicResolution')?.status==='applying')await chat.setFlag(MOD,'relicResolution',{status:'failed',error:error.message});
  report(error);
 });
 void lensHit(chat).catch(report);
});
Hooks.on('updateChatMessage',chat=>{void lensHit(chat).catch(report);});
Hooks.on('renderChatMessageHTML',(chat,html)=>{
 if(chat.type!=='usage'||!KEYS.has(relicKey(chat.getAssociatedActivity?.()?.item)))return;
 const status=chat.getFlag(MOD,'relicResolution')?.status;
 const labels={done:'Реликвия применена.',cancelled:'Применение отменено; ресурсы не потрачены.',applying:'Выполняется…',failed:'Применение прервано. Ведущему нужно проверить уже потраченные ресурсы; не повторяйте запрос.'};
 const p=document.createElement('p');p.textContent=labels[status]??'Ожидает подтверждения ведущего.';html.append(p);
});
Hooks.once('ready',()=>{game.modules.get(MOD).api.relics={processRequest,execute,planDice,prepareSaveReduction,lensHit};});
