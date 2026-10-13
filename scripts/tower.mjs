const MOD='bagrovoe-bleeding';
let queue=Promise.resolve();
const flag=(d,k)=>d?.getFlag?.(MOD,k)??d?.flags?.[MOD]?.[k];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const warn=e=>{console.error(MOD,e);ui.notifications.error(`Башня магов: ${e.message}`);};
const active=()=>game.user?.isGM&&game.users.activeGM?.id===game.user.id;
const available=i=>Math.max(0,Number(i.system.uses.max)-Number(i.system.uses.spent||0));

export function rechargeable(item){
 const u=item?.system?.uses,props=new Set(item?.system?.properties||[]),rarities=new Set(item?.system?.rarities||[]);
 return ['weapon','equipment','tool'].includes(item?.type)&&!rarities.has('artifact')&&(props.has('mgc')||[...rarities].some(r=>['common','uncommon','rare','veryRare','legendary'].includes(r)))&&Number.isFinite(Number(u?.max))&&Number(u.max)>0&&Number(u.spent)>0;
}

export function slotRecovery(actor,input,budget){
 const update={};let total=0;
 for(let n=1;n<=5;n++){
  const count=Number(input['slot'+n]??0),slot=actor.system.spells['spell'+n],max=Number(slot?.max??slot?.override??0),value=Number(slot?.value||0);
  if(!Number.isInteger(count)||count<0||count>Math.max(0,max-value))throw Error('Выбрано больше ячеек, чем потрачено.');
  total+=n*count;if(count)update[`system.spells.spell${n}.value`]=value+count;
 }
 if(total<1||total>budget)throw Error(`Сумма кругов должна быть от 1 до ${budget}.`);
 return update;
}

export async function restoreCharges(actor,feature,item,amount,chat){
 if(!active()||!actor?.isOwner||!flag(actor,'towerCouncil'))throw Error('Дар применяет активный ведущий.');
 if(flag(chat,'towerReceipt')?.status==='applying'||flag(chat,'towerReceipt')?.status==='done')return;
 if(!rechargeable(item)||!Number.isInteger(amount)||amount<1||amount>4)throw Error('Предмет больше нельзя зарядить этим даром.');
 if(available(feature)<1)throw Error('Искра Созидателя уже израсходована.');
 const spent=Number(item.system.uses.spent),restored=Math.min(spent,amount);
 // Persist intent before either mutation. Never replay an interrupted transfer.
 await chat.setFlag(MOD,'towerReceipt',{status:'applying',item:item.uuid,restored});
 await feature.update({'system.uses.spent':Number(feature.system.uses.spent||0)+1});
 await item.update({'system.uses.spent':spent-restored});
 await chat.setFlag(MOD,'towerReceipt',{status:'done',item:item.uuid,restored});
 return restored;
}

async function choose(title,content){return foundry.applications.api.DialogV2.wait({window:{title},content,buttons:[
 {action:'apply',label:'Применить',callback:(_e,b)=>Object.fromEntries(new FormData(b.form).entries())},
 {action:'cancel',label:'Отмена',default:true,callback:()=>null}],rejectClose:false});}

export function validateTowerUse(activity){
 const actor=activity.actor??activity.item?.actor,key=flag(activity,'towerAction');
 if(!key||!flag(actor,'towerCouncil'))return;
 if(!game.user?.isGM||!game.users.activeGM){ui.notifications.warn('Для этой способности нужен ведущий.');return false;}
 if(['recharge-item','recover-slots'].includes(key)&&available(activity.item)<1){ui.notifications.warn('Все применения уже израсходованы.');return false;}
}

async function process(chat){
 if(!active()||chat.type!=='usage'||!chat.author?.isGM||flag(chat,'towerReceipt'))return;
 const activity=chat.getAssociatedActivity?.(),actor=activity?.actor??activity?.item?.actor;
 if(!flag(actor,'towerCouncil'))return;
 const key=flag(activity,'towerAction');if(!key)return;
 const feature=actor.items.get(activity.item.id);if(!feature)return;
 if(key==='toggle-flight'){
  await chat.setFlag(MOD,'towerReceipt',{status:'applying'});
  const prior=flag(actor,'towerFlight');
  await actor.update({'system.attributes.movement.speeds.fly':prior?prior.previous:String(flag(activity,'speed')||30),[`flags.${MOD}.towerFlight`]:prior?null:{previous:String(actor.system.attributes.movement.speeds.fly||'0')}});
  await chat.setFlag(MOD,'towerReceipt',{status:'done'});return;
 }
 if(available(feature)<1)throw Error('Применение уже израсходовано.');
 let target=actor;
 if(key==='recharge-item'){
  const selected=chat.system?.targets||[];if(selected.length>1)throw Error('Выберите не больше одного владельца предмета.');
  if(selected.length){const token=await fromUuid(selected[0].token);target=token?.actor;if(!target)throw Error('Не найден владелец предмета.');
   if(target.uuid!==actor.uuid){const speaker=chat.speaker??ChatMessage.getSpeaker({actor}),self=actor.token??game.scenes.get(speaker.scene)?.tokens.get(speaker.token);if(!self||!globalThis.BagrovoeNewSpells||globalThis.BagrovoeNewSpells.distance(self,token)>5)throw Error('Для касания владелец предмета должен быть рядом, в пределах 5 футов.');}
  }
  const items=[...target.items].filter(rechargeable);if(!items.length)throw Error('У выбранного владельца нет магического снаряжения с потраченными зарядами.');
  const input=await choose('Искра Созидателя',`<p>Минута касания восстанавливает 1к4 заряда. Отмена не тратит дар.</p><label>Предмет<select name="item">${items.map(i=>`<option value="${esc(i.id)}">${esc(i.name)} — потрачено ${Number(i.system.uses.spent)}</option>`).join('')}</select></label>`);
  if(!input){await chat.setFlag(MOD,'towerReceipt',{status:'cancelled'});return;}
  const item=target.items.get(input.item);if(!items.some(i=>i.id===item?.id))throw Error('Выбран неподходящий предмет.');
  const roll=await new Roll('1d4').evaluate();
  const restored=await restoreCharges(actor,feature,item,roll.total,chat);
  await roll.toMessage({speaker:ChatMessage.getSpeaker({actor}),flavor:`Искра Созидателя — ${esc(item.name)}: восстановлено ${restored} зарядов.`,whisper:game.users.filter(u=>u.isGM).map(u=>u.id)});return;
 }
 if(key==='recover-slots'){
  const budget=Number(flag(activity,'budget'));
  const input=await choose(feature.name,`<p>После завершённого короткого отдыха. Сумма кругов — не более ${budget}. Раз в день.</p>${[1,2,3,4,5].map(n=>{const s=actor.system.spells['spell'+n],missing=Math.max(0,Number(s?.max??s?.override??0)-Number(s?.value||0));return `<label>${n}-й круг<input type="number" name="slot${n}" value="0" min="0" max="${missing}" step="1"></label>`;}).join('')}`);
  if(!input){await chat.setFlag(MOD,'towerReceipt',{status:'cancelled'});return;}
  const update=slotRecovery(actor,input,budget);if(available(feature)<1)throw Error('Восстановление уже израсходовано.');
  await chat.setFlag(MOD,'towerReceipt',{status:'applying'});
  await feature.update({'system.uses.spent':Number(feature.system.uses.spent||0)+1});
  await actor.update(update);await chat.setFlag(MOD,'towerReceipt',{status:'done'});
 }
}
export function processTowerUse(chat){const work=queue.catch(()=>{}).then(()=>process(chat));queue=work;return work;}
Hooks.on('dnd5e.preUseActivity',validateTowerUse);
Hooks.on('dnd5e.preActivityConsumption',validateTowerUse);
Hooks.on('createChatMessage',chat=>{void processTowerUse(chat).catch(warn);});
Hooks.once('ready',()=>{const module=game.modules.get(MOD);module.api??={};module.api.tower={processTowerUse};});
