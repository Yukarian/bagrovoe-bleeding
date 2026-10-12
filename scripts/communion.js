(() => {
 const MOD='bagrovoe-bleeding', pending=new Map();
 const leader=()=>game.user?.isGM && game.users.activeGM?.id===game.user.id;
 const living=a=>a && !a.statuses?.has('dead') && !['undead','construct'].includes(a.system.details?.type?.value);
 const previous=globalThis.BagrovoeSpellRuntime.validateUse;
 globalThis.BagrovoeSpellRuntime.validateUse=(activity,usage,message)=>{
  if(previous(activity,usage,message)===false)return false;
  const item=activity.item,support=item?.getFlag(MOD,'communionSupport'),kneel=item?.getFlag(MOD,'communionKneel');
  if(!support&&!kneel)return;
  const warn=text=>{ui.notifications.warn(text);return false;};
  const maximum=Number(item.system.uses?.max);
  if(maximum && Number(item.system.uses.spent)>=maximum)return warn('Применения способности закончились.');
  const targets=message?.data?.system?.targets??[],limit=support?.maxTargets??1;
  if(!targets.length||targets.length>limit)return warn(`Выберите от 1 до ${limit} целей.`);
  const speaker=message?.data?.speaker??ChatMessage.getSpeaker({actor:item.actor});
  const self=item.actor.token??game.scenes.get(speaker.scene)?.tokens.get(speaker.token);
  if(!self)return warn('Для проверки дистанции разместите NPC на сцене.');
  const seen=new Set();
  for(const entry of targets){
   const token=globalThis.fromUuidSync(entry.token),actor=token?.actor;
   if(!actor)return warn('У выбранной цели нет листа персонажа.');
   if(seen.has(actor.uuid))return warn('Выберите разных существ.');seen.add(actor.uuid);
   if((support?.living||kneel)&&!living(actor))return warn('Эта молитва не действует на мёртвых, нежить и конструктов.');
   if(globalThis.BagrovoeNewSpells.distance(self,token)>(support?.range??60))return warn('Цель находится за пределами дистанции способности.');
  }
 };
 async function applyKneel(chat){
  if(!leader()||chat.type!=='save')return;
  const origin=chat.system?.origin,source=origin?await fromUuid(`ChatMessage.${origin}`):null;
  const activity=source?.getAssociatedActivity?.()??chat.getAssociatedActivity?.(),item=activity?.item;
  if(!item?.getFlag(MOD,'communionKneel'))return;
  const actor=chat.getAssociatedActor?.(),total=chat.rolls?.[0]?.total,dc=Number(activity.save?.dc?.value);
  if(!actor||!Number.isFinite(total)||!Number.isFinite(dc))return;
  const key=actor.uuid;
  const task=(pending.get(key)??Promise.resolve()).catch(()=>{}).then(async()=>{
   const existing=actor.effects.filter(e=>e.getFlag(MOD,'kneelSave')===chat.id);
   if(chat.system.forceSuccess||chat.system.resisted||total>=dc){
    if(existing.length)await actor.deleteEmbeddedDocuments('ActiveEffect',existing.map(e=>e.id));return;
   }
   if(!living(actor)||actor.statuses?.has('prone')||Array.from(actor.system.traits?.ci?.value??[]).includes('prone')||existing.length||chat.getFlag(MOD,'kneelDone'))return;
   await actor.createEmbeddedDocuments('ActiveEffect',[{name:'Повеление: на колени',img:item.img,origin:item.uuid,transfer:false,disabled:false,changes:[],statuses:['prone'],flags:{[MOD]:{kneelSave:chat.id}}}]);
   await chat.setFlag(MOD,'kneelDone',true);
  });
  pending.set(key,task);try{return await task;}finally{if(pending.get(key)===task)pending.delete(key);}
 }
 globalThis.BagrovoeCommunion={applyKneel};
 for(const event of ['createChatMessage','updateChatMessage'])Hooks.on(event,chat=>{void applyKneel(chat).catch(error=>{console.error(MOD,error);ui.notifications.error('Не удалось применить повеление жреца. Проверьте состояние цели.');});});
})();
