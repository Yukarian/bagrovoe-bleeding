const MOD = "bagrovoe-bleeding";
const processed = new WeakSet();
const inFlight = new Map();
const num = (v, fallback=0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const clamp = (x, low, high) => Math.max(low,Math.min(high,x));
const enabled = (a) => a?.getFlag?.(MOD,"bloodMagic") === true || a?.system?.details?.type?.subtype === "заражённый";
const owned = actor => actor?.isOwner || game.user?.isGM;
const bloodCast = activity => activity?.type === "cast" && (activity?.spell?.uuid?.startsWith("Compendium.bagrovoe-bleeding.blood-spells.") || activity?.item?.getFlag?.(MOD,"bloodMagic") === true);
function hdPools(actor) {
  const classes = actor.items.filter(item => item.type === "class");
  if (classes.length) return classes.map(cls => ({
    doc:cls, path:"system.hd.spent", size: Math.max(1,num(cls.system.hd?.denomination?.replace("d",""),8)),
    maximum:Math.max(0,num(cls.system.levels,0)+num(cls.system.hd?.additional,0)),
    spent:Math.max(0,num(cls.system.hd?.spent))
  })).filter(p=>p.maximum);
  const hd=actor.system.attributes.hd??{};
  const formula=actor.system.attributes.hp?.formula??"";
  const match=String(formula).match(/(\d+)d(\d+)/i);
  return [{doc:actor,path:"system.attributes.hd.spent",size:Math.max(1,num(hd.denomination?.replace?.("d",""),num(match?.[2],8))),
    maximum:Math.max(0,num(hd.max,num(match?.[1],0))),spent:Math.max(0,num(hd.spent))}];
}
function chooseDice(actor, count) {
 const pools=hdPools(actor).sort((a,b)=>a.size-b.size);
 const spent=[];let missing=count;
 for(const pool of pools){const use=Math.min(missing, Math.max(0,pool.maximum-pool.spent));if(use){spent.push({pool,count:use});missing-=use;}}
 return {spent,missing,die:pools[0]?.size??8};
}
async function costOf(activity,config) {
  const selected = config?.spellLevel ?? config?.slotLevel ?? activity?.spell?.level;
  if(selected !== null && selected !== undefined) return clamp(Math.trunc(num(selected)),0,9);
  const uuid=activity?.spell?.uuid;
  if(!uuid)return 0;
  const spell=await fromUuid(uuid);
  return clamp(Math.trunc(num(spell?.system?.level)),0,9);
}
async function pay(actor,cost) {
 if(!owned(actor))throw Error("Нет прав на изменение Костей Хитов");
 const {spent,missing,die}=chooseDice(actor,cost);
 for(const {pool,count} of spent)await pool.doc.update({[pool.path]:pool.spent+count});
 let total=0,expression="";
 if(missing){
   expression=`${missing}d${die}`;
   total=(await new Roll(expression).evaluate()).total;
   const hp=actor.system.attributes.hp;
   await actor.update({"system.attributes.hp.value":Math.max(0,hp.value-total)});
   if(hp.value-total<=0) await actor.toggleStatusEffect("unconscious",{active:true});
   if(hp.value-total<=-Math.max(1,hp.max))await actor.toggleStatusEffect("dead",{active:true});
 }
 await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),content:`<p><strong>Кровавое колдовство:</strong> ${actor.name} — стоимость ${cost} КХ, потрачено ${cost-missing}, нехватка ${missing}${missing?`, урон ${expression} = ${total} (без защит и временных хитов)`:""}.</p>`});
 return {missing,total};
}
async function regain(actor,number=1){
 const spent=hdPools(actor).sort((a,b)=>b.size-a.size);
 let left=number,recovered=0;
 for(const p of spent){const n=Math.min(left,p.spent);if(n){await p.doc.update({[p.path]:p.spent-n});left-=n;recovered+=n;}}
 return recovered;
}
async function steal(caster,target,amount=1,heal=0){
 if(!owned(caster)||!owned(target))throw Error("Для похищения ведущий должен иметь доступ к обоим актёрам");
 if(target.statuses.has("dead")||target.system.details?.type?.value==="undead")return 0;
 const pools=hdPools(target);
 let remaining=amount,stolen=0;
 for(const p of pools){const n=Math.min(remaining,Math.max(0,p.maximum-p.spent));if(n){await p.doc.update({[p.path]:p.spent+n});stolen+=n;remaining-=n;}}
 const restored=await regain(caster,stolen);
 if(heal&&stolen){const hp=caster.system.attributes.hp;await caster.update({"system.attributes.hp.value":Math.min(hp.max,hp.value+heal*stolen)});}
 return restored;
}
Hooks.on("dnd5e.preUseLinkedSpell",(activity,usageConfig)=>{
 if(!bloodCast(activity))return;
 // Do not spend regular spell slots for a blood cast.
 usageConfig.consumeSpellSlot=false;
 if(usageConfig.consumption)usageConfig.consumption.spellSlot=false;
});
Hooks.on("dnd5e.postUseLinkedSpell",(activity,usageConfig,results)=>{
 if(!bloodCast(activity)||!results||!activity.item?.actor)return;
 const actor=activity.item.actor;
 if(!owned(actor))return;
 if(processed.has(results))return;
 processed.add(results);
 const previous=inFlight.get(actor.uuid)??Promise.resolve();
 const next=previous.catch(()=>{}).then(async()=>{
   const cost=await costOf(activity,usageConfig);
   if(cost)return pay(actor,cost);
 });
 inFlight.set(actor.uuid,next);
 next.catch(error=>ui.notifications.error("Багровое Причастие: "+error.message))
     .finally(()=>{if(inFlight.get(actor.uuid)===next)inFlight.delete(actor.uuid);});
});
Hooks.once("ready",()=>{
 const module=game.modules.get(MOD);
 if(!module)return;
 module.api??={};
 Object.assign(module.api,{bloodMagic:{hdPools,chooseDice,pay,regain,steal}});
 globalThis.BagrovoeBloodMagic={hdPools,chooseDice,pay,regain,steal};
});
