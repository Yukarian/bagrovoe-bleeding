(() => {
 const MOD='bagrovoe-bleeding',pending=new Map();
 const leader=()=>game.user?.isGM&&game.users.activeGM?.id===game.user.id;
 async function slow(chat){
  if(!leader()||chat.type!=='attack')return;
  const item=chat.getAssociatedActivity?.()?.item;
  if(!item?.getFlag(MOD,'onHitSlow'))return;
  if(pending.has(chat.id))return pending.get(chat.id);
  const task=resolveSlow(chat,item).finally(()=>pending.delete(chat.id));pending.set(chat.id,task);return task;
 }
 async function resolveSlow(chat,item){
  await globalThis.BagrovoeSpellRuntime.resolveAttack(chat);
  for(const hit of chat.system.evaluatedTargets??[]){
   if(hit.isMiss!==false)continue;
   const token=await fromUuid(hit.token),actor=token?.actor;if(!actor)continue;
   const key=hit.token.replaceAll('.','_');if(chat.getFlag(MOD,'siblingSlow')?.[key])continue;
   const bleeding=game.modules.get(MOD).api.get(token);
   if(!bleeding||bleeding.disabled||bleeding.isSuppressed||actor.statuses?.has('dead'))continue;
   // Persist the receipt before mutation to prevent duplicate effects on hook replays.
   await chat.setFlag(MOD,`siblingSlow.${key}`,true);
   const previous=actor.effects.filter(e=>e.getFlag(MOD,'heartBladeSlow'));
   if(previous.length)await actor.deleteEmbeddedDocuments('ActiveEffect',previous.map(e=>e.id));
   await actor.createEmbeddedDocuments('ActiveEffect',[{name:`${item.name}: замедление`,img:item.img,origin:item.uuid,transfer:false,disabled:false,
    changes:[{key:'system.attributes.movement.multiplier',mode:1,value:'0.5',priority:20}],
    flags:{[MOD]:{heartBladeSlow:true,expires:{...globalThis.BagrovoeSpellRuntime.expiry(item.actor),start:true}}}}]);
  }
 }
 const validate=globalThis.BagrovoeSpellRuntime.validateUse;
 globalThis.BagrovoeSpellRuntime.validateUse=(activity,usage,message)=>{
  if(validate(activity,usage,message)===false)return false;
  if(!activity.item?.getFlag(MOD,'siblingWard'))return;
  const item=activity.item,targets=message?.data?.system?.targets??[];
  if(Number(item.system.uses.spent)>=Number(item.system.uses.max)){ui.notifications.warn('Применения заслона закончились.');return false;}
  if(targets.length!==1){ui.notifications.warn('Выберите одного другого союзника для заслона.');return false;}
  const target=globalThis.fromUuidSync?.(targets[0].token);
  if(!target?.actor||target.actor.uuid===item.actor.uuid){ui.notifications.warn('Заслон предназначен для другого существа.');return false;}
  // preUseActivity has targets but normally no speaker yet in D&D5e 6.0.6.
  const speaker=message?.data?.speaker??ChatMessage.getSpeaker({actor:item.actor});
  const self=item.actor.token??game.scenes.get(speaker?.scene)?.tokens.get(speaker?.token);
  if(!self||globalThis.BagrovoeNewSpells.distance(self,target)>30){ui.notifications.warn('Союзник должен находиться в пределах 30 футов от токена Эмили.');return false;}
 };
 globalThis.BagrovoeSiblings={slow};
 for(const event of ['createChatMessage','updateChatMessage'])Hooks.on(event,chat=>{void slow(chat).catch(error=>{console.error(MOD,error);ui.notifications.error('Не удалось завершить замедление Клинка сердца. Проверьте эффекты цели.');});});
})();
