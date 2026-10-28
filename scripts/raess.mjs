const MOD='bagrovoe-bleeding';
const flag=(d,k)=>d?.flags?.[MOD]?.[k];
const identifier=i=>i?.system?.identifier;
const find=(a,k)=>a?.items?.find(i=>identifier(i)===k);

// Participate in the native consumption transaction, including its refund deltas.
// Do not replenish resources on previews or when consumption was unchecked.
export function raessConsumption(activity,config,message,updates){
 const actor=activity.actor??activity.item?.actor;
 if(!flag(actor,'raess')||identifier(activity.item)!=='magical-cunning'||!game.user?.isGM)return;
 const cost=updates.item?.find(i=>i._id===activity.item.id)?.['system.uses.spent'];
 if(!(cost>Number(activity.item.system.uses.spent??0)))return;
 const edict=find(actor,'decisive-edict');
 if(edict){const existing=updates.item.find(i=>i._id===edict.id);if(existing)existing['system.uses.spent']=0;else updates.item.push({_id:edict.id,'system.uses.spent':0});}
 const slots=actor.system.spells.pact;
 const key='system.spells.pact.value';
 if(key in updates.actor)updates.actor[key]=Math.min(Number(slots.max??slots.override??3),updates.actor[key]);
}

// The triggering HP change, temporary HP and encounter receipt are one Actor update.
// Only actual damage crossing the threshold during this actor's combat can trigger it.
export function raessBloodied(actor,change){
 if(!flag(actor,'raess')||!game.user?.isGM||!find(actor,'raess-defeat'))return;
 const combat=game.combat;
 if(!combat?.started||!combat.combatants?.some(c=>c.actor?.uuid===actor.uuid))return;
 const value=change['system.attributes.hp.value']??change.system?.attributes?.hp?.value;
 if(value===undefined)return;
 const hp=actor.system.attributes.hp,half=Number(hp.max)/2;
 if(!(Number(hp.value)>half&&Number(value)<=half)||flag(actor,'raessBloodiedCombat')===combat.id)return;
 const pending=change['system.attributes.hp.temp']??change.system?.attributes?.hp?.temp??hp.temp??0;
 const temp=Math.max(Number(pending),10);
 if(change.system?.attributes?.hp)change.system.attributes.hp.temp=temp;
 else change['system.attributes.hp.temp']=temp;
 change[`flags.${MOD}.raessBloodiedCombat`]=combat.id;
}

export function raessSubmitImmunity(effect){
 if(!flag(effect,'raessSubmit'))return;
 const values=effect.parent?.system?.traits?.ci?.value;
 if(values?.has?.('charmed')||values?.includes?.('charmed'))return false;
}

Hooks.on('dnd5e.activityConsumption',raessConsumption);
Hooks.on('preUpdateActor',raessBloodied);
Hooks.on('preCreateActiveEffect',raessSubmitImmunity);
